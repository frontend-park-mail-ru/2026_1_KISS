import { EventApi } from '../api/EventApi.js';

const HEARTBEAT_INTERVAL_MS = 60_000;

export class Heartbeat {
    static #instance = null;
    #intervalId = null;
    #eventApi;

    constructor() {
        if (Heartbeat.#instance) {
            return Heartbeat.#instance;
        }
        this.#eventApi = new EventApi();
        Heartbeat.#instance = this;
    }

    static getInstance() {
        if (!Heartbeat.#instance) {
            new Heartbeat();
        }
        return Heartbeat.#instance;
    }

    start() {
        if (this.#intervalId) {
            return;
        }
        this.#send();
        this.#intervalId = setInterval(() => this.#send(), HEARTBEAT_INTERVAL_MS);

        window.addEventListener('beforeunload', this.#onUnload);
    }

    stop() {
        if (this.#intervalId) {
            clearInterval(this.#intervalId);
            this.#intervalId = null;
        }
        window.removeEventListener('beforeunload', this.#onUnload);
    }

    #send() {
        this.#eventApi.trackEvent('heartbeat').catch(() => {});
    }

    #onUnload = () => {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const body = JSON.stringify({ event_type: 'heartbeat', metadata: '{}' });
            navigator.sendBeacon(
                '/api/v1/events/track',
                new Blob([body], { type: 'application/json' })
            );
        }
    };
}
