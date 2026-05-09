import { HttpClient } from '../http_client/HttpClient.js';
import type { Comment } from '../types.js';
import type { ApiEnvelope } from './types.js';

/**
 * API-клиент для работы с notebook-сервисом: блоки, комментарии, переименования.
 * Бэкенд: cmd/notebook (gRPC за gateway). Все эндпоинты под /api/v1/notebooks/*.
 */
export class NotebookApi {
    #http: HttpClient;

    /**
     * Берёт singleton HttpClient — все API-клиенты делят один кэш и сессию.
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
     * Загружает все комментарии к одному блоку. Соответствует
     * GET /notebooks/:nb/blocks/:b/comments.
     * @param notebookId - ID notebook'а
     * @param blockId - ID блока
     * @returns промис с массивом комментариев (пустой если нет)
     */
    public async getComments(
        notebookId: number | string,
        blockId: number | string
    ): Promise<Comment[]> {
        const response = await this.#http.get(
            `/notebooks/${String(notebookId)}/blocks/${String(blockId)}/comments`
        );
        return this.#parse<Comment[]>(response);
    }

    /**
     * Добавляет комментарий к блоку. Соответствует
     * POST /notebooks/:nb/blocks/:b/comments.
     * @param notebookId - ID notebook'а
     * @param blockId - ID блока
     * @param text - текст комментария
     * @returns промис с созданным комментарием (с присвоенным id)
     */
    public async addComment(
        notebookId: number | string,
        blockId: number | string,
        text: string
    ): Promise<Comment> {
        const response = await this.#http.post(
            `/notebooks/${String(notebookId)}/blocks/${String(blockId)}/comments`,
            { text }
        );
        return this.#parse<Comment>(response);
    }

    /**
     * Удаляет комментарий. Доступно автору или владельцу notebook'а.
     * Соответствует DELETE /notebooks/:nb/blocks/:b/comments/:id.
     * @param notebookId - ID notebook'а
     * @param blockId - ID блока
     * @param commentId - ID удаляемого комментария
     * @throws Error при HTTP не-2xx (например 403 если нет прав)
     */
    public async deleteComment(
        notebookId: number | string,
        blockId: number | string,
        commentId: number | string
    ): Promise<void> {
        const response = await this.#http.delete(
            `/notebooks/${String(notebookId)}/blocks/${String(blockId)}/comments/${String(commentId)}`
        );
        if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
    }
}
