import { HttpClient } from '../http_client/HttpClient.js';
import type {
    AiModelsResponse,
    ChatHistoryResponse,
    ChatSettingsDTO,
    ChatUsageResponse
} from './chatTypes.js';
import type { ApiEnvelope } from './types.js';

/**
 * REST-клиент для AI-чата: история переписки в ноутбуке, пользовательские
 * настройки (модель + системный промпт), статистика использования и список
 * доступных моделей с учётом тарифа. WS-стриминг сообщений — в ChatWS.
 *
 * Бэкенд: cmd/chat за gateway, эндпоинты `/api/v1/chat/*`.
 */
export class AiApi {
    #http: HttpClient;

    /**
     * Получает singleton HttpClient: shared cookie-сессия и CSRF-токен.
     */
    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    /**
     * Парсит JSON-ответ, проверяет ApiEnvelope и бросает Error при не-2xx.
     * @param response - объект Response от fetch
     * @returns распакованный body.data типа T
     * @throws Error с серверным error или 'HTTP <status>' если тело пустое
     */
    async #parse<T>(response: Response): Promise<T> {
        const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
        if (!response.ok) {
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
        return body.data as T;
    }

    /**
     * Возвращает историю переписки по ноутбуку в хронологическом порядке.
     * @param notebookId - ID ноутбука
     * @param limit - максимум сообщений (по умолчанию 200 на бэке)
     * @returns массив сообщений
     */
    public async getHistory(notebookId: number, limit?: number): Promise<ChatHistoryResponse> {
        const qs = limit !== undefined && limit > 0 ? `&limit=${String(limit)}` : '';
        const r = await this.#http.get(`/chat/history?notebook_id=${String(notebookId)}${qs}`, {
            noCache: true
        });
        return this.#parse<ChatHistoryResponse>(r);
    }

    /**
     * Очищает историю чата для конкретного ноутбука. Возвращает 204 без тела.
     * @param notebookId - ID ноутбука
     */
    public async clearHistory(notebookId: number): Promise<void> {
        const r = await this.#http.delete(`/chat/history?notebook_id=${String(notebookId)}`);
        if (!r.ok) throw new Error(`HTTP ${String(r.status)}`);
    }

    /**
     * Загружает пользовательские настройки чата с ИИ (модель + системный промпт).
     * Если настроек ещё нет — сервер вернёт дефолты для текущего тарифа.
     * @returns снимок настроек
     */
    public async getSettings(): Promise<ChatSettingsDTO> {
        const r = await this.#http.get('/chat/settings', { noCache: true });
        return this.#parse<ChatSettingsDTO>(r);
    }

    /**
     * Обновляет настройки чата. Модель должна быть в whitelist текущего тарифа,
     * иначе бэкенд вернёт 403.
     * @param model - идентификатор модели
     * @param systemPrompt - системный промпт (не более 8000 символов)
     * @returns обновлённый снимок настроек
     */
    public async updateSettings(model: string, systemPrompt: string): Promise<ChatSettingsDTO> {
        const r = await this.#http.put('/chat/settings', {
            model,
            system_prompt: systemPrompt
        });
        return this.#parse<ChatSettingsDTO>(r);
    }

    /**
     * Возвращает статистику использования: расход за сегодня, лимиты тарифа,
     * общие итоги и разбивку по моделям.
     * @returns снимок использования
     */
    public async getUsage(): Promise<ChatUsageResponse> {
        const r = await this.#http.get('/chat/usage', { noCache: true });
        return this.#parse<ChatUsageResponse>(r);
    }

    /**
     * Возвращает список всех известных моделей с пометкой доступности
     * для текущего пользователя (в зависимости от его тарифа).
     * @returns список моделей
     */
    public async getModels(): Promise<AiModelsResponse> {
        const r = await this.#http.get('/chat/models', { noCache: true });
        return this.#parse<AiModelsResponse>(r);
    }
}
