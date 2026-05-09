import { HttpClient } from '../http_client/HttpClient.js';

/**
 * API-клиент для трекинга пользовательских событий (analytics).
 * События собираются на бэкенде в users_events таблицу — используются для DAU/MAU.
 */
export class EventApi {
    #http: HttpClient;

    /**
     * Берёт singleton HttpClient.
     */
    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    /**
     * Отправляет событие в трекер. metadata сериализуется в JSON-строку
     * (так бэк ожидает — текстовое поле в БД).
     * Не ждёт результата (fire-and-forget) — promise возвращается на случай
     * если вызывающий хочет проверить успех/обработать.
     * @param eventType - тип события ('login', 'notebook_open', 'block_execute', ...)
     * @param metadata - произвольный объект с деталями события
     * @returns промис Response
     */
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
