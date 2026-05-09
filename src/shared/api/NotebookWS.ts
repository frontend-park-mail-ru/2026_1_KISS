import { nn } from '../utils/notNull.js';

/**
 * WebSocket-клиент для real-time коллаборации над notebook'ом. Подключается к
 * ws(s)://host/api/v1/ws/notebooks/:id, шлёт CRUD-команды над блоками и принимает
 * события об изменениях от других пользователей (NotebookEventDTO).
 *
 * Особенности:
 * - **Авто-reconnect** с экспоненциальным backoff (1s → 2s → 4s → 8s → 15s).
 * - **Ping/pong** каждые 25 секунд для keepalive (gateway закрывает idle-соединения).
 * - **Коды 4400-4499** трактуются как permanent-ошибки (forbidden, notebook не найден)
 *   и не вызывают reconnect.
 * - **closedByUser** — флаг ручного close() чтобы не зацикливаться на reconnect.
 */
export class NotebookWS {
    #notebookId: number | string;
    #socket: WebSocket | null = null;
    #pingTimer: ReturnType<typeof setInterval> | null = null;
    #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    #reconnectAttempt = 0;
    #closedByUser = false;
    #onEvent: (event: Record<string, unknown>) => void;
    #onConnect: (() => void) | null;
    #onClose: ((code: number) => void) | null;

    /**
     * Создаёт клиент с привязкой к notebook'у. Соединение НЕ устанавливается —
     * нужно явно вызвать connect().
     * @param notebookId - ID notebook'а к которому подключаемся
     * @param callbacks - обработчики onEvent/onConnect/onClose (все опциональные)
     */
    public constructor(
        notebookId: number | string,
        {
            onEvent,
            onConnect,
            onClose
        }: {
            onEvent?: (event: Record<string, unknown>) => void;
            onConnect?: () => void;
            onClose?: (code: number) => void;
        } = {}
    ) {
        this.#notebookId = notebookId;
        this.#onEvent =
            onEvent ??
            ((): void => {
                /* noop */
            });
        this.#onConnect = onConnect ?? null;
        this.#onClose = onClose ?? null;
    }

    /**
     * Открывает WebSocket-соединение. Сбрасывает флаг closedByUser чтобы
     * reconnect работал. Можно вызывать повторно — каждый вызов открывает новое.
     */
    public connect(): void {
        this.#closedByUser = false;
        this.#open();
    }

    /**
     * Корректно закрывает соединение и останавливает все таймеры. После close()
     * reconnect не происходит — это финальный teardown компонента.
     */
    public close(): void {
        this.#closedByUser = true;
        if (this.#reconnectTimer !== null) {
            clearTimeout(this.#reconnectTimer);
            this.#reconnectTimer = null;
        }
        this.#stopPing();
        if (this.#socket) {
            try {
                this.#socket.close(1000, 'client closed');
            } catch {
                /* ignore */
            }
            this.#socket = null;
        }
    }

    /**
     * Отправляет команду обновления содержимого блока. Бэкенд применит изменение
     * и разошлёт block_updated событие всем подключённым клиентам.
     * @param blockId - ID блока
     * @param content - новое содержимое
     * @param language - опциональный язык (для code-блоков)
     */
    public updateBlock(blockId: number, content: string, language?: string): void {
        this.#send({ type: 'update_block', block_id: blockId, content, language });
    }

    /**
     * Отправляет команду создания нового блока на заданной позиции.
     * Бэкенд разошлёт block_added событие.
     * @param position - позиция вставки (0-based)
     * @param blockType - 'code' или 'text'
     * @param language - опциональный язык для code-блоков
     */
    public addBlock(position: number, blockType: 'code' | 'text', language?: string): void {
        this.#send({ type: 'add_block', position, block_type: blockType, language });
    }

    /**
     * Отправляет команду удаления блока. Бэкенд разошлёт block_deleted событие.
     * @param blockId - ID удаляемого блока
     */
    public deleteBlock(blockId: number): void {
        this.#send({ type: 'delete_block', block_id: blockId });
    }

    /**
     * Запускает блок через WS (альтернатива HTTP-эндпоинту RunnerApi.executeBlock).
     * Output приходит чанками через onEvent (StreamChunkEvent).
     * @param blockPosition - позиция запускаемого блока
     */
    public executeBlock(blockPosition: number): void {
        this.#send({ type: 'execute_block', block_position: blockPosition });
    }

    /**
     * Проверяет состояние соединения.
     * @returns true если WebSocket в состоянии OPEN
     */
    public isOpen(): boolean {
        return Boolean(this.#socket) && this.#socket.readyState === WebSocket.OPEN;
    }

    /**
     * Внутренний метод открытия соединения. Регистрирует обработчики open/message/close/error,
     * стартует ping-таймер при успешном open, планирует reconnect при error на конструкторе.
     */
    #open(): void {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/api/v1/ws/notebooks/${String(this.#notebookId)}`;
        let socket: WebSocket;
        try {
            socket = new WebSocket(url);
        } catch {
            this.#scheduleReconnect();
            return;
        }
        this.#socket = socket;

        socket.addEventListener('open', () => {
            this.#reconnectAttempt = 0;
            this.#startPing();
            if (this.#onConnect) this.#onConnect();
        });

        socket.addEventListener('message', (e: MessageEvent) => {
            let msg: Record<string, unknown>;
            try {
                msg = JSON.parse(e.data as string) as Record<string, unknown>;
            } catch {
                return;
            }
            if (msg.type === 'pong') return;
            this.#onEvent(msg);
        });

        socket.addEventListener('close', (e: CloseEvent) => {
            this.#stopPing();
            this.#socket = null;
            if (this.#onClose) this.#onClose(e.code);
            if (this.#closedByUser || (e.code >= 4400 && e.code < 4500)) return;
            this.#scheduleReconnect();
        });

        socket.addEventListener('error', () => {
            /* noop */
        });
    }

    /**
     * Планирует переподключение с экспоненциальным backoff (1s, 2s, 4s, 8s, 15s).
     * После 4 попыток delay фиксируется на 15 секундах.
     */
    #scheduleReconnect(): void {
        if (this.#closedByUser) return;
        const delay = Math.min(15000, 1000 * 2 ** Math.min(this.#reconnectAttempt, 4));
        this.#reconnectAttempt += 1;
        this.#reconnectTimer = setTimeout(() => {
            this.#reconnectTimer = null;
            this.#open();
        }, delay);
    }

    /**
     * Сериализует и отправляет payload через WebSocket. Если соединение не OPEN
     * или send бросил ошибку — возвращает false (вызывающий может ретраить).
     * @param payload - объект для JSON.stringify
     * @returns true если send удался, false иначе
     */
    #send(payload: Record<string, unknown>): boolean {
        if (!this.isOpen()) return false;
        try {
            nn(this.#socket).send(JSON.stringify(payload));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Запускает ping-таймер (каждые 25 секунд). Перед стартом останавливает
     * предыдущий чтобы не накапливались.
     */
    #startPing(): void {
        this.#stopPing();
        this.#pingTimer = setInterval(() => this.#send({ type: 'ping' }), 25000);
    }

    /**
     * Останавливает ping-таймер если он активен.
     */
    #stopPing(): void {
        if (this.#pingTimer !== null) {
            clearInterval(this.#pingTimer);
            this.#pingTimer = null;
        }
    }
}
