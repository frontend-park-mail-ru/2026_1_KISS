import { HttpClient } from '../http_client/HttpClient.js';
import type {
    ApiEnvelope,
    FileItemDTO,
    FileListResponse,
    FileShareDTO,
    FileShareListResponse,
    FileUsageResponse
} from './types.js';

/**
 * API-клиент storage-сервиса: загрузка пользовательских файлов, листинг,
 * удаление, информация о занятой квоте. Бэкенд: cmd/storage (через gateway,
 * /api/v1/files/*). Лимит на пользователя выставляется по тарифу на стороне
 * gateway — клиент только читает результат /files/usage.
 */
export class StorageApi {
    static #instance: StorageApi | null = null;

    #http: HttpClient;

    /**
     * Прямой вызов запрещён — используйте getInstance(), чтобы все API-клиенты
     * делили один HttpClient (и его кэш/сессию).
     * @throws Error при попытке создать второй экземпляр
     */
    public constructor() {
        if (StorageApi.#instance) {
            throw new Error('Use StorageApi.getInstance() instead of new StorageApi()');
        }
        this.#http = HttpClient.getInstance();
        StorageApi.#instance = this;
    }

    /**
     * Возвращает singleton-экземпляр клиента, создавая при первом обращении.
     * @returns единственный экземпляр StorageApi
     */
    public static getInstance(): StorageApi {
        StorageApi.#instance ??= new StorageApi();
        return StorageApi.#instance;
    }

    /**
     * Парсит JSON-ответ с ApiEnvelope, бросает Error при не-2xx.
     * @param response - объект Response от fetch
     * @returns распакованный data типа T
     * @throws Error со строкой error или 'HTTP <status>'
     */
    async #parse<T>(response: Response): Promise<T> {
        const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
        if (!response.ok) {
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
        return body.data as T;
    }

    /**
     * Загружает один файл в storage. Соответствует POST /api/v1/files/upload
     * с multipart/form-data и query-параметром category. Сервер проверяет
     * MIME, расширение и квоту тарифа; при превышении квоты вернёт 507.
     * @param file - объект File из input[type=file] или drag-and-drop
     * @param category - категория хранения ('files' по умолчанию)
     * @returns промис с FileItemDTO загруженного файла
     * @throws Error при HTTP не-2xx (например 507 при превышении квоты,
     *   400 при недопустимом MIME/расширении)
     */
    public async uploadFile(file: File, category = 'files'): Promise<FileItemDTO> {
        const url = `/files/upload?category=${encodeURIComponent(category)}`;
        const response = await this.#http.upload(url, file, 'file');
        return this.#parse<FileItemDTO>(response);
    }

    /**
     * Загружает страницу файлов текущего пользователя. Соответствует
     * GET /api/v1/files?category=&limit=&offset=. Категория опциональна:
     * пустая строка вернёт файлы всех категорий.
     * @param limit - размер страницы (макс 100 на бэке)
     * @param offset - смещение страницы
     * @param category - фильтр по категории (необязателен)
     * @returns промис с FileListResponse (массив files + total)
     * @throws Error при HTTP не-2xx
     */
    public async listFiles(
        limit: number,
        offset: number,
        category?: string
    ): Promise<FileListResponse> {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', String(offset));
        if (category !== undefined && category !== '') {
            params.set('category', category);
        }
        const response = await this.#http.get(`/files?${params.toString()}`, { noCache: true });
        return this.#parse<FileListResponse>(response);
    }

    /**
     * Удаляет файл по UUID. Соответствует DELETE /api/v1/files/:id. Сервер
     * проверяет владение файлом; чужой файл вернёт 403.
     * @param id - UUID файла
     * @throws Error при HTTP не-2xx
     */
    public async deleteFile(id: string): Promise<void> {
        const response = await this.#http.delete(`/files/${encodeURIComponent(id)}`);
        if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
    }

    /**
     * Возвращает квоту и текущее потребление диска пользователя.
     * Соответствует GET /api/v1/files/usage.
     * @returns промис с FileUsageResponse (used/limit/plan/...)
     * @throws Error при HTTP не-2xx
     */
    public async getUsage(): Promise<FileUsageResponse> {
        const response = await this.#http.get('/files/usage', { noCache: true });
        return this.#parse<FileUsageResponse>(response);
    }

    /**
     * Админская выдача файлов. Соответствует GET /api/v1/admin/storage/files
     * с фильтрами category и owner_id и пагинацией. Доступно только admin'у;
     * для не-admin'ов сервер вернёт 403.
     * @param params - объект фильтров
     * @returns промис с FileListResponse
     * @throws Error при HTTP не-2xx
     */
    /**
     * Загружает страницу файлов, расшаренных текущему пользователю.
     * Соответствует GET /api/v1/files/shared?limit=&offset=.
     * @param limit - размер страницы
     * @param offset - смещение
     * @returns промис со списком файлов
     * @throws Error при HTTP не-2xx
     */
    public async listSharedWithMe(limit: number, offset: number): Promise<FileListResponse> {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', String(offset));
        const response = await this.#http.get(`/files/shared?${params.toString()}`, {
            noCache: true
        });
        return this.#parse<FileListResponse>(response);
    }

    /**
     * Расшаривает файл по email или username. Соответствует
     * POST /api/v1/files/:id/share. Если пользователь не найден на бэке —
     * вернёт 404; уровень принимает 'view' или 'download'.
     * @param fileId - UUID файла
     * @param identifier - email или username получателя
     * @param level - 'view' (без скачивания) или 'download'
     * @returns промис с FileShareDTO выданного приглашения
     * @throws Error при HTTP не-2xx
     */
    public async shareFile(
        fileId: string,
        identifier: string,
        level: 'view' | 'download'
    ): Promise<FileShareDTO> {
        const response = await this.#http.post(`/files/${encodeURIComponent(fileId)}/share`, {
            identifier,
            level
        });
        return this.#parse<FileShareDTO>(response);
    }

    /**
     * Возвращает список приглашений к файлу. Доступно только владельцу.
     * @param fileId - UUID файла
     * @returns промис со списком приглашений
     * @throws Error при HTTP не-2xx
     */
    public async listShares(fileId: string): Promise<FileShareListResponse> {
        const response = await this.#http.get(`/files/${encodeURIComponent(fileId)}/shares`, {
            noCache: true
        });
        return this.#parse<FileShareListResponse>(response);
    }

    /**
     * Меняет уровень доступа для уже приглашённого пользователя.
     * @param fileId - UUID файла
     * @param userId - ID пользователя
     * @param level - новый уровень
     * @returns промис с обновлённой записью
     * @throws Error при HTTP не-2xx
     */
    public async updateShare(
        fileId: string,
        userId: number,
        level: 'view' | 'download'
    ): Promise<FileShareDTO> {
        const response = await this.#http.put(
            `/files/${encodeURIComponent(fileId)}/shares/${String(userId)}`,
            { level }
        );
        return this.#parse<FileShareDTO>(response);
    }

    /**
     * Отзывает доступ конкретного пользователя к файлу.
     * @param fileId - UUID файла
     * @param userId - ID пользователя
     * @throws Error при HTTP не-2xx
     */
    public async revokeShare(fileId: string, userId: number): Promise<void> {
        const response = await this.#http.delete(
            `/files/${encodeURIComponent(fileId)}/shares/${String(userId)}`
        );
        if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
    }

    /**
     * Включает или выключает публичную ссылку. При включении бэк генерирует
     * UUID-токен (вернётся в FileItemDTO.share_token); при выключении токен
     * обнуляется и старая ссылка перестаёт работать.
     * @param fileId - UUID файла
     * @param isPublic - true — выдать публичную ссылку, false — отозвать
     * @param expiresAt - ISO-дата истечения (опционально, только при isPublic=true)
     * @returns промис с обновлённой записью файла
     * @throws Error при HTTP не-2xx
     */
    public async setPublic(
        fileId: string,
        isPublic: boolean,
        expiresAt?: string | null
    ): Promise<FileItemDTO> {
        const payload: Record<string, unknown> = { is_public: isPublic };
        if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
            payload.expires_at = expiresAt;
        }
        const response = await this.#http.put(
            `/files/${encodeURIComponent(fileId)}/public`,
            payload
        );
        return this.#parse<FileItemDTO>(response);
    }

    /**
     * Переименовывает файл (меняется только отображаемое имя; storage_key и
     * прямой URL остаются прежними, поэтому существующие ссылки на файл
     * продолжают работать).
     * @param fileId - UUID файла
     * @param filename - новое имя (1..255, без / и \)
     * @returns промис с обновлённым DTO
     * @throws Error при HTTP не-2xx (например 400 при недопустимом имени)
     */
    public async renameFile(fileId: string, filename: string): Promise<FileItemDTO> {
        const response = await this.#http.patch(`/files/${encodeURIComponent(fileId)}/rename`, {
            filename
        });
        return this.#parse<FileItemDTO>(response);
    }

    /**
     * Админская выдача файлов. Соответствует GET /api/v1/admin/storage/files
     * с фильтрами category и owner_id и пагинацией. Доступно только admin'у.
     * @param params - объект фильтров (limit, offset, category?, ownerId?)
     * @returns промис с FileListResponse
     * @throws Error при HTTP не-2xx
     */
    public async adminListFiles(params: {
        limit: number;
        offset: number;
        category?: string;
        ownerId?: number;
    }): Promise<FileListResponse> {
        const qs = new URLSearchParams();
        qs.set('limit', String(params.limit));
        qs.set('offset', String(params.offset));
        if (params.category !== undefined && params.category !== '') {
            qs.set('category', params.category);
        }
        if (params.ownerId !== undefined && params.ownerId > 0) {
            qs.set('owner_id', String(params.ownerId));
        }
        const response = await this.#http.get(`/admin/storage/files?${qs.toString()}`, {
            noCache: true
        });
        return this.#parse<FileListResponse>(response);
    }
}
