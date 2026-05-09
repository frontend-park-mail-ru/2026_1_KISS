import { EventApi } from '../api/EventApi.js';
import { nn } from '../utils/notNull.js';

const HEARTBEAT_INTERVAL_MS = 60_000;

export class Heartbeat {
    static #instance: Heartbeat | null = null;
    #intervalId: ReturnType<typeof setInterval> | null = null;
    #eventApi!: EventApi;

    public constructor() {
        if (Heartbeat.#instance) {
            return Heartbeat.#instance;
        }
        this.#eventApi = new EventApi();
        Heartbeat.#instance = this;
    }

    public static getInstance(): Heartbeat {
        if (!Heartbeat.#instance) {
            new Heartbeat();
        }
        return nn(Heartbeat.#instance);
    }

    public start(): void {
        if (this.#intervalId) {
            return;
        }
        this.#send();
        this.#intervalId = setInterval(() => { this.#send(); }, HEARTBEAT_INTERVAL_MS);

        window.addEventListener('beforeunload', this.#onUnload);
    }

    public stop(): void {
        if (this.#intervalId) {
            clearInterval(this.#intervalId);
            this.#intervalId = null;
        }
        window.removeEventListener('beforeunload', this.#onUnload);
    }

    #send(): void {
        this.#eventApi.trackEvent('heartbeat').catch(() => {});
    }

    #onUnload = (): void => {
        if (typeof navigator !== 'undefined') {
            const body = JSON.stringify({ event_type: 'heartbeat', metadata: '{}' });
            navigator.sendBeacon(
                '/api/v1/events/track',
                new Blob([body], { type: 'application/json' })
            );
        }
    };
}
