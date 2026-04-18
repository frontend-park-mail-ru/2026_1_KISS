import { HttpClient } from '../http_client/HttpClient.js';

export class EventApi {
    #http;

    constructor() {
        this.#http = HttpClient.getInstance();
    }

    trackEvent(eventType, metadata = {}) {
        return this.#http.post('/events/track', {
            event_type: eventType,
            metadata: JSON.stringify(metadata)
        });
    }
}
