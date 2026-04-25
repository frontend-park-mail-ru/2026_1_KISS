/**
 * @module shared/api/NotebookWS
 *
 * Клиент WebSocket-канала ноутбука.
 *
 * Транспорт: подключается к `wss?://<host>/api/v1/ws/notebooks/{id}` — куки
 * `session_id` передаются автоматически (same-origin). Бэкенд закрывает
 * соединение HTTP-кодами 401/403/404 до апгрейда.
 *
 * Протокол совпадает с REALTIME_PLAN.md / ws_handler.go:
 *   client → server: { type: "ping" | "update_block" | "add_block" | "delete_block", ... }
 *   server → client: { type: "pong" | "block_added" | "block_updated"
 *                         | "block_deleted" | "notebook_updated" | "error", ... }
 *
 * Авто-reconnect с экспоненциальным backoff (1s … 15s). При успешном
 * подключении вызывает onConnect — потребитель должен сделать REST-fetch
 * актуального состояния, потому что между разрывом и переподключением
 * события могли быть пропущены.
 */
export class NotebookWS {
    /** @type {number} */
    #notebookId;

    /** @type {?WebSocket} */
    #socket = null;

    /** @type {?number} */
    #pingTimer = null;

    /** @type {?number} */
    #reconnectTimer = null;

    /** @type {number} */
    #reconnectAttempt = 0;

    /** @type {boolean} */
    #closedByUser = false;

    /** @type {(event: object) => void} */
    #onEvent;

    /** @type {?() => void} */
    #onConnect;

    /** @type {?(code: number) => void} */
    #onClose;

    /**
     * @param {number|string} notebookId
     * @param {Object} handlers
     * @param {(event: object) => void} handlers.onEvent — событие сервера (block_added/updated/deleted/notebook_updated)
     * @param {() => void} [handlers.onConnect] — соединение открыто (можно ресинхронизироваться с REST)
     * @param {(code: number) => void} [handlers.onClose] — соединение закрыто (с кодом WS), для UI-индикации
     */
    constructor(notebookId, { onEvent, onConnect, onClose } = {}) {
        this.#notebookId = notebookId;
        this.#onEvent = onEvent || (() => {});
        this.#onConnect = onConnect || null;
        this.#onClose = onClose || null;
    }

    connect() {
        this.#closedByUser = false;
        this.#open();
    }

    close() {
        this.#closedByUser = true;
        if (this.#reconnectTimer) {
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
     * Уведомить сервер об обновлении содержимого блока. Сервер ответит
     * событием `block_updated` для всех клиентов (включая нас, отфильтруем
     * по actor_id).
     * @param {number} blockId
     * @param {string} content
     * @param {string} [language]
     */
    updateBlock(blockId, content, language) {
        this.#send({ type: 'update_block', block_id: blockId, content, language });
    }

    /**
     * @param {number} position 0-индексированная позиция (сейчас сервер игнорирует и кладёт в конец, см. usecase.AddBlock)
     * @param {'code'|'text'} blockType
     * @param {string} [language]
     */
    addBlock(position, blockType, language) {
        this.#send({ type: 'add_block', position, block_type: blockType, language });
    }

    deleteBlock(blockId) {
        this.#send({ type: 'delete_block', block_id: blockId });
    }

    isOpen() {
        return !!this.#socket && this.#socket.readyState === WebSocket.OPEN;
    }

    #open() {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/api/v1/ws/notebooks/${this.#notebookId}`;
        let socket;
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

        socket.addEventListener('message', (e) => {
            let msg;
            try {
                msg = JSON.parse(e.data);
            } catch {
                return;
            }
            if (msg && msg.type === 'pong') return;
            this.#onEvent(msg);
        });

        socket.addEventListener('close', (e) => {
            this.#stopPing();
            this.#socket = null;
            if (this.#onClose) this.#onClose(e.code);
            // 4xxx — фатальные коды (4401/4403/4404), не переподключаемся
            if (this.#closedByUser || (e.code >= 4400 && e.code < 4500)) return;
            this.#scheduleReconnect();
        });

        socket.addEventListener('error', () => {
            // close сработает следом, реальная логика там
        });
    }

    #scheduleReconnect() {
        if (this.#closedByUser) return;
        const delay = Math.min(15000, 1000 * 2 ** Math.min(this.#reconnectAttempt, 4));
        this.#reconnectAttempt += 1;
        this.#reconnectTimer = setTimeout(() => {
            this.#reconnectTimer = null;
            this.#open();
        }, delay);
    }

    #send(payload) {
        if (!this.isOpen()) return false;
        try {
            this.#socket.send(JSON.stringify(payload));
            return true;
        } catch {
            return false;
        }
    }

    #startPing() {
        this.#stopPing();
        // 25s — заметно меньше любых разумных idle-таймаутов прокси
        this.#pingTimer = setInterval(() => this.#send({ type: 'ping' }), 25000);
    }

    #stopPing() {
        if (this.#pingTimer) {
            clearInterval(this.#pingTimer);
            this.#pingTimer = null;
        }
    }
}
