import { nn } from '../utils/notNull.js';
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
        this.#onEvent = onEvent ?? (() => {});
        this.#onConnect = onConnect ?? null;
        this.#onClose = onClose ?? null;
    }

    public connect(): void {
        this.#closedByUser = false;
        this.#open();
    }

    public close(): void {
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

    public updateBlock(blockId: number, content: string, language?: string): void {
        this.#send({ type: 'update_block', block_id: blockId, content, language });
    }

    public addBlock(position: number, blockType: 'code' | 'text', language?: string): void {
        this.#send({ type: 'add_block', position, block_type: blockType, language });
    }

    public deleteBlock(blockId: number): void {
        this.#send({ type: 'delete_block', block_id: blockId });
    }

    public executeBlock(blockPosition: number): void {
        this.#send({ type: 'execute_block', block_position: blockPosition });
    }

    public isOpen(): boolean {
        return Boolean(this.#socket) && this.#socket.readyState === WebSocket.OPEN;
    }

    #open(): void {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/api/v1/ws/notebooks/${this.#notebookId}`;
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
                msg = JSON.parse(e.data as string);
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

        socket.addEventListener('error', () => {});
    }

    #scheduleReconnect(): void {
        if (this.#closedByUser) return;
        const delay = Math.min(15000, 1000 * 2 ** Math.min(this.#reconnectAttempt, 4));
        this.#reconnectAttempt += 1;
        this.#reconnectTimer = setTimeout(() => {
            this.#reconnectTimer = null;
            this.#open();
        }, delay);
    }

    #send(payload: Record<string, unknown>): boolean {
        if (!this.isOpen()) return false;
        try {
            nn(this.#socket).send(JSON.stringify(payload));
            return true;
        } catch {
            return false;
        }
    }

    #startPing(): void {
        this.#stopPing();
        this.#pingTimer = setInterval(() => this.#send({ type: 'ping' }), 25000);
    }

    #stopPing(): void {
        if (this.#pingTimer) {
            clearInterval(this.#pingTimer);
            this.#pingTimer = null;
        }
    }
}
