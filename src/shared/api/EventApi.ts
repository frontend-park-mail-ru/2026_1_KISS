import { HttpClient } from '../http_client/HttpClient.js';

export class EventApi {
    #http: HttpClient;

    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    public trackEvent(
        eventType: string,
        metadata: Record<string, unknown> = {}
    ): Promise<Response> {
        return this.#http.post('/events/track', {
            event_type: eventType,
            metadata: JSON.stringify(metadata)
        });
    }
}
