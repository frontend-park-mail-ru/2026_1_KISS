import { nn } from '../utils/notNull.js';
import type { ChatContextOptions, ChatWSIncoming } from './chatTypes.js';

/**
 * WebSocket-клиент для AI-чата. Подключается к ws(s)://host/api/v1/chat/ws,
 * шлёт пользовательские сообщения и принимает поток чанков ответа модели
 * с типизированными событиями (chunk / done / error).
 *
 * Особенности:
 * - **Авто-reconnect** с экспоненциальным backoff (1s → 2s → 4s → 8s → 15s).
 * - **Ping/pong** каждые 25 секунд для keepalive — gateway закрывает idle.
 * - **Коды 4400–4499** считаются permanent (forbidden, freeze-план) и не
 *   вызывают reconnect.
 * - **closedByUser** — флаг ручного close() чтобы не зацикливать reconnect.
 *
 * В отличие от NotebookWS, здесь нет привязки к notebookId на уровне URL —
 * сессия открыта один раз для пользователя, а notebook_id передаётся внутри
 * каждого сообщения.
 */
export class ChatWS {
    #socket: WebSocket | null = null;
    #pingTimer: ReturnType<typeof setInterval> | null = null;
    #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    #reconnectAttempt = 0;
    #closedByUser = false;
    #onMessage: (event: ChatWSIncoming) => void;
    #onConnect: (() => void) | null;
    #onClose: ((code: number) => void) | null;

    /**
     * Создаёт клиент. Соединение НЕ открывается — нужен явный вызов connect().
     * @param callbacks - обработчики событий (onMessage обязателен по смыслу)
     */
    public constructor({
        onMessage,
        onConnect,
        onClose
    }: {
        onMessage?: (event: ChatWSIncoming) => void;
        onConnect?: () => void;
        onClose?: (code: number) => void;
    } = {}) {
        this.#onMessage =
            onMessage ??
            ((): void => {
                /* noop */
            });
        this.#onConnect = onConnect ?? null;
        this.#onClose = onClose ?? null;
    }

    /**
     * Открывает WebSocket-соединение и сбрасывает closedByUser, чтобы
     * reconnect работал при последующих обрывах.
     */
    public connect(): void {
        this.#closedByUser = false;
        this.#open();
    }

    /**
     * Финально закрывает соединение, останавливает таймеры и блокирует
     * автоматический reconnect.
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
     * Отправляет пользовательское сообщение в чат. Ответ придёт серией
     * `chunk`-событий, завершающим `done` и опционально `error`.
     * @param notebookId - ID ноутбука для привязки истории
     * @param content - текст сообщения
     * @param model - идентификатор модели (пусто — серверный default)
     * @param context - дополнительный контекст (ячейка/ноутбук)
     * @returns true если send удался, false при закрытом сокете
     */
    public sendMessage(
        notebookId: number,
        content: string,
        model?: string,
        context?: ChatContextOptions
    ): boolean {
        return this.#send({
            type: 'message',
            notebook_id: notebookId,
            content,
            model,
            context
        });
    }

    /**
     * Проверяет состояние соединения.
     * @returns true если WebSocket в состоянии OPEN
     */
    public isOpen(): boolean {
        return this.#socket !== null && this.#socket.readyState === WebSocket.OPEN;
    }

    /**
     * Внутренний метод открытия соединения. Регистрирует обработчики
     * open/message/close/error, стартует ping-таймер при open.
     */
    #open(): void {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/api/v1/chat/ws`;
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
            let msg: ChatWSIncoming;
            try {
                msg = JSON.parse(e.data as string) as ChatWSIncoming;
            } catch {
                return;
            }
            if (msg.type === 'pong') return;
            this.#onMessage(msg);
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
     * Планирует переподключение с экспоненциальным backoff (1s, 2s, 4s, 8s, 15s),
     * после 4 попыток delay фиксируется на 15 секундах.
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
     * Сериализует и отправляет payload через WebSocket.
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
     * Запускает ping-таймер (каждые 25 секунд).
     */
    #startPing(): void {
        this.#stopPing();
        this.#pingTimer = setInterval(() => this.#send({ type: 'ping' }), 25000);
    }

    /**
     * Останавливает ping-таймер, если он активен.
     */
    #stopPing(): void {
        if (this.#pingTimer !== null) {
            clearInterval(this.#pingTimer);
            this.#pingTimer = null;
        }
    }
}
