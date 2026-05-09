import { EventApi } from '../api/EventApi.js';

const HEARTBEAT_INTERVAL_MS = 60_000;

export class Heartbeat {
    static #instance: Heartbeat | null = null;
    #intervalId: ReturnType<typeof setInterval> | null = null;
    #eventApi!: EventApi;

    public constructor() {
        this.#eventApi = new EventApi();
    }

    public static getInstance(): Heartbeat {
        Heartbeat.#instance ??= new Heartbeat();
        return Heartbeat.#instance;
    }

    public start(): void {
        if (this.#intervalId !== null) {
            return;
        }
        this.#send();
        this.#intervalId = setInterval(() => {
            this.#send();
        }, HEARTBEAT_INTERVAL_MS);

        window.addEventListener('beforeunload', this.#onUnload);
    }

    public stop(): void {
        if ((this.#intervalId ?? 0) !== 0) {
            clearInterval(this.#intervalId);
            this.#intervalId = null;
        }
        window.removeEventListener('beforeunload', this.#onUnload);
    }

    #send(): void {
        this.#eventApi.trackEvent('heartbeat').catch(() => {
            /* noop */
        });
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
