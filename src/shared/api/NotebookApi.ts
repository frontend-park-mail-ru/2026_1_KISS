import { HttpClient } from '../http_client/HttpClient.js';
import type { Comment } from '../types.js';
import type { ApiEnvelope, BlockDTO, NotebookDTO, PermissionListResponse } from './types.js';

/**
 * Описание блока для импорта notebook'а из .ipynb. Минимальный набор полей,
 * которых ждёт сервер на POST /notebooks/import: тип, язык, содержимое,
 * позиция и опционально outputs.
 */
export interface ImportBlockInput {
    /** Тип блока: 'code' или 'text' */
    type: string;
    /** Язык программирования для code-блоков (для text-блоков '') */
    language: string;
    /** Содержимое блока (исходный код или markdown) */
    content: string;
    /** Позиция блока в notebook'е */
    position: number;
    /** Outputs последнего исполнения (для импорта существующих результатов) */
    outputs: { output_type: string; content: string; position: number }[];
}

/**
 * API-клиент для работы с notebook-сервисом: блоки, комментарии, переименования,
 * импорт из .ipynb, пересортировка, выдача прав. Бэкенд: cmd/notebook (gRPC за
 * gateway). Все эндпоинты под /api/v1/notebooks/*.
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
     * Проверяет ответ mutation-запросов: при не-2xx бросает Error с
     * серверным сообщением. Используется для DELETE/PUT/POST без тела ответа.
     * @param response - объект Response от fetch
     * @throws Error при HTTP не-2xx
     */
    async #ensureOk(response: Response): Promise<void> {
        if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
    }

    /**
     * Загружает notebook вместе с блоками. Соответствует GET /notebooks/:id.
     * Опционально обходит in-memory GET-кэш HttpClient (нужно после mutations).
     * @param notebookId - ID или slug notebook'а
     * @param options - опции запроса; noCache=true принудительно идёт в сеть
     * @returns промис с NotebookDTO (включая поле blocks)
     * @throws Error при HTTP не-2xx (например 404 если notebook не найден)
     */
    public async getNotebook(
        notebookId: number | string,
        options?: { noCache?: boolean }
    ): Promise<NotebookDTO> {
        const response = await this.#http.get(`/notebooks/${String(notebookId)}`, options);
        return this.#parse<NotebookDTO>(response);
    }

    /**
     * Загружает список выданных прав для notebook'а. Доступно владельцу или
     * пользователю с правом на этот notebook. Соответствует
     * GET /notebooks/:id/permissions.
     * @param notebookId - ID notebook'а
     * @returns промис с PermissionListResponse (массив permissions)
     * @throws Error при HTTP не-2xx (например 403 если нет прав)
     */
    public async getPermissions(notebookId: number | string): Promise<PermissionListResponse> {
        const response = await this.#http.get(`/notebooks/${String(notebookId)}/permissions`);
        return this.#parse<PermissionListResponse>(response);
    }

    /**
     * Переименовывает notebook. Соответствует PUT /notebooks/:id с телом
     * { title }. Возвращает обновлённый NotebookDTO.
     * @param notebookId - ID notebook'а
     * @param title - новое название
     * @returns промис с обновлённым NotebookDTO
     * @throws Error при HTTP не-2xx
     */
    public async renameNotebook(notebookId: number | string, title: string): Promise<NotebookDTO> {
        const response = await this.#http.put(`/notebooks/${String(notebookId)}`, { title });
        return this.#parse<NotebookDTO>(response);
    }

    /**
     * Сохраняет содержимое блока. Соответствует
     * PUT /notebooks/:nb/blocks/:b с телом { content }. Используется как
     * для code-блоков, так и для text-блоков (auto-save и явное сохранение).
     * @param notebookId - ID notebook'а
     * @param blockId - ID блока
     * @param content - новое содержимое (исходный код или markdown)
     * @throws Error при HTTP не-2xx
     */
    public async updateBlockContent(
        notebookId: number | string,
        blockId: number | string,
        content: string
    ): Promise<void> {
        const response = await this.#http.put(
            `/notebooks/${String(notebookId)}/blocks/${String(blockId)}`,
            { content }
        );
        await this.#ensureOk(response);
    }

    /**
     * Создаёт новый блок в notebook'е (всегда добавляется в конец).
     * Соответствует POST /notebooks/:nb/blocks. Для type='code' автоматически
     * проставляет language='python'.
     * @param notebookId - ID notebook'а
     * @param type - тип блока: 'code' или 'text'
     * @returns промис с созданным BlockDTO (с присвоенным id и position)
     * @throws Error при HTTP не-2xx
     */
    public async createBlock(notebookId: number | string, type: string): Promise<BlockDTO> {
        const body: Record<string, string> = { type, content: '' };
        if (type === 'code') {
            body.language = 'python';
        }
        const response = await this.#http.post(`/notebooks/${String(notebookId)}/blocks`, body);
        return this.#parse<BlockDTO>(response);
    }

    /**
     * Удаляет блок из notebook'а. Соответствует
     * DELETE /notebooks/:nb/blocks/:b.
     * @param notebookId - ID notebook'а
     * @param blockId - ID удаляемого блока
     * @throws Error при HTTP не-2xx
     */
    public async deleteBlock(notebookId: number | string, blockId: number | string): Promise<void> {
        const response = await this.#http.delete(
            `/notebooks/${String(notebookId)}/blocks/${String(blockId)}`
        );
        await this.#ensureOk(response);
    }

    /**
     * Меняет порядок блоков в notebook'е (например после drag-n-drop в UI).
     * Сервер обновляет position у каждого блока по присланному массиву id.
     * Соответствует PUT /notebooks/:nb/reorder с телом { block_ids }.
     * @param notebookId - ID notebook'а
     * @param blockIds - новый порядок идентификаторов блоков
     * @throws Error при HTTP не-2xx
     */
    public async reorderBlocks(
        notebookId: number | string,
        blockIds: (number | string)[]
    ): Promise<void> {
        const response = await this.#http.put(`/notebooks/${String(notebookId)}/reorder`, {
            block_ids: blockIds
        });
        await this.#ensureOk(response);
    }

    /**
     * Импортирует notebook из распарсенного .ipynb. Соответствует
     * POST /notebooks/import. Возвращает созданный NotebookDTO с id, который
     * можно использовать для редиректа на страницу нового блокнота.
     * @param title - название создаваемого notebook'а
     * @param blocks - массив блоков в формате ImportBlockInput
     * @returns промис с созданным NotebookDTO
     * @throws Error при HTTP не-2xx
     */
    public async importNotebook(title: string, blocks: ImportBlockInput[]): Promise<NotebookDTO> {
        const response = await this.#http.post('/notebooks/import', { title, blocks });
        return this.#parse<NotebookDTO>(response);
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
        await this.#ensureOk(response);
    }
}
