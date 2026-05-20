import type { ContainerStatsDTO } from './types.js';

/**
 * WebSocket-клиент стриминга статистики контейнера.
 * Сервер пушит кадр каждые 2 с; при обрыве — reconnect с backoff.
 * Коды 4400-4499 — permanent-ошибки, reconnect не делается.
 */
export class StatsWS {
    #notebookId: number | string;
    #socket: WebSocket | null = null;
    #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    #reconnectAttempt = 0;
    #closedByUser = false;
    #onStats: (stats: ContainerStatsDTO) => void;
    #onClose: (() => void) | null;

    /**
     * Создаёт клиент, привязанный к notebook'у. Соединение НЕ открывается —
     * нужно вызвать connect() явно.
     * @param notebookId - ID notebook'а
     * @param onStats - колбэк на каждый принятый кадр статистики
     * @param options - опциональный onClose для уведомления о разрыве
     */
    public constructor(
        notebookId: number | string,
        onStats: (stats: ContainerStatsDTO) => void,
        { onClose }: { onClose?: () => void } = {}
    ) {
        this.#notebookId = notebookId;
        this.#onStats = onStats;
        this.#onClose = onClose ?? null;
    }

    /**
     * Открывает WebSocket. Сбрасывает флаг closedByUser чтобы reconnect работал.
     */
    public connect(): void {
        this.#closedByUser = false;
        this.#open();
    }

    /** Корректно закрывает соединение, reconnect после не происходит. */
    public close(): void {
        this.#closedByUser = true;
        if (this.#reconnectTimer !== null) {
            clearTimeout(this.#reconnectTimer);
            this.#reconnectTimer = null;
        }
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
     * Внутреннее открытие соединения. Подвешивает обработчики open/message/close/error,
     * на close планирует reconnect (кроме closedByUser и кодов 4400-4499).
     */
    #open(): void {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/api/v1/ws/runner/${String(this.#notebookId)}/stats`;
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
        });

        socket.addEventListener('message', (e: MessageEvent) => {
            try {
                const stats = JSON.parse(e.data as string) as ContainerStatsDTO;
                this.#onStats(stats);
            } catch {
                /* ignore malformed frame */
            }
        });

        socket.addEventListener('close', (e: CloseEvent) => {
            this.#socket = null;
            if (this.#onClose) this.#onClose();
            if (this.#closedByUser || (e.code >= 4400 && e.code < 4500)) return;
            this.#scheduleReconnect();
        });

        socket.addEventListener('error', () => {
            /* noop */
        });
    }

    /**
     * Планирует переподключение с экспоненциальным backoff (1s, 2s, 4s, 8s,
     * далее cap'нуто 15s). Игнорирует вызов если closedByUser=true.
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
}
