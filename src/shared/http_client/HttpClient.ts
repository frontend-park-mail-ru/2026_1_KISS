/**
 * Singleton HTTP-клиент для работы с Go-бэкендом через API gateway.
 *
 * Особенности:
 * - **CSRF**: автоматически читает токен из cookie 'csrf_token' и подставляет
 *   в заголовок X-CSRF-Token для всех не-GET/HEAD запросов (Go-gateway его проверяет).
 * - **GET-кэш**: in-memory кэш с TTL 30 секунд; инвалидируется любой mutation-операцией.
 * - **credentials: include**: cookies (session) шлются всегда — для cross-origin тоже.
 * - **Multipart upload**: отдельный метод upload() для файлов с ручной сборкой тела
 *   (без FormData — там есть граничные случаи с CSRF и encoding'ом).
 *
 * Использование: `const http = HttpClient.getInstance(); await http.get('/users/me');`
 */
export class HttpClient {
    static #instance: HttpClient | null = null;

    public baseUrl = `${window.location.origin}/api/v1`;

    public headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    #cache = new Map<string, { data: unknown; ts: number }>();
    #cacheTTL = 30_000;

    /**
     * Прямой вызов конструктора запрещён — используйте getInstance().
     * Защита нужна чтобы случайно не создать второй экземпляр (с другим кэшем
     * и потерянными хедерами).
     * @throws Error при попытке создать второй экземпляр
     */
    public constructor() {
        if (HttpClient.#instance) {
            throw new Error('Use HttpClient.getInstance() instead of new HttpClient()');
        }
        HttpClient.#instance = this;
    }

    /**
     * Возвращает singleton-экземпляр клиента, создаёт при первом обращении.
     * @returns единственный экземпляр HttpClient
     */
    public static getInstance(): HttpClient {
        HttpClient.#instance ??= new HttpClient();
        return HttpClient.#instance;
    }

    /**
     * GET-запрос с опциональным in-memory кэшем (TTL 30 секунд). Кэшированные
     * ответы возвращаются как новый Response с тем же телом, чтобы вызывающий
     * код мог одинаково работать с .json()/.text(). Если noCache=true — кэш
     * игнорируется при чтении, но запись после успешного запроса всё равно идёт.
     * @param url - путь относительно baseUrl (например '/users/me')
     * @param options - опции; noCache отключает чтение из кэша
     * @returns промис Response от fetch (либо из кэша)
     */
    public get(url: string, options?: { noCache?: boolean }): Promise<Response> {
        if (options?.noCache !== true) {
            const cached = this.#cache.get(url);
            if (cached && Date.now() - cached.ts < this.#cacheTTL) {
                return Promise.resolve(
                    new Response(JSON.stringify(cached.data), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                );
            }
        }
        return this.request('GET', url).then(async (response) => {
            if (response.ok && options?.noCache !== true) {
                const data = (await response.clone().json()) as unknown;
                this.#cache.set(url, { data, ts: Date.now() });
            }
            return response;
        });
    }

    /**
     * POST-запрос. Очищает GET-кэш (как любая mutation). Тело сериализуется через
     * JSON.stringify; если data === undefined, тело не отправляется.
     * @param url - путь относительно baseUrl
     * @param data - тело запроса (любой JSON-сериализуемый объект)
     * @returns промис Response
     */
    public post(url: string, data?: unknown): Promise<Response> {
        return this.request('POST', url, data);
    }

    /**
     * PUT-запрос. Очищает GET-кэш. Используется для полного обновления ресурса.
     * @param url - путь относительно baseUrl
     * @param data - тело запроса
     * @returns промис Response
     */
    public put(url: string, data: unknown): Promise<Response> {
        return this.request('PUT', url, data);
    }

    /**
     * DELETE-запрос. Очищает GET-кэш.
     * @param url - путь относительно baseUrl
     * @returns промис Response
     */
    public delete(url: string): Promise<Response> {
        return this.request('DELETE', url);
    }

    /**
     * PATCH-запрос. Очищает GET-кэш. Используется для частичного обновления ресурса.
     * @param url - путь относительно baseUrl
     * @param data - тело запроса (только изменяемые поля)
     * @returns промис Response
     */
    public patch(url: string, data: unknown): Promise<Response> {
        return this.request('PATCH', url, data);
    }

    /**
     * Multipart-загрузка одного файла. Собирает body вручную (Blob с граничными
     * маркерами) — FormData не используется чтобы точно контролировать заголовки
     * и сериализацию имени файла (escape кавычек/переносов).
     * @param url - путь относительно baseUrl
     * @param file - объект File из input[type=file]
     * @param fieldName - имя multipart-поля (бэкенд ждёт 'avatar', 'feedback', и т.д.)
     * @returns промис Response от сервера загрузки
     */
    public upload(url: string, file: File, fieldName = 'avatar'): Promise<Response> {
        const boundary = `----FormBoundary${String(Date.now())}${Math.random().toString(36).slice(2)}`;
        const safeName = file.name.replace(/["\r\n]/g, '_');
        const body = new Blob([
            `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${safeName}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
            file,
            `\r\n--${boundary}--\r\n`
        ]);

        const uploadHeaders: Record<string, string> = {
            'Content-Type': `multipart/form-data; boundary=${boundary}`
        };
        const csrfToken = this.#getCookie('csrf_token');
        if (csrfToken) {
            uploadHeaders['X-CSRF-Token'] = csrfToken;
        }
        return fetch(this.baseUrl + url, {
            method: 'POST',
            headers: uploadHeaders,
            body,
            credentials: 'include'
        });
    }

    /**
     * Читает значение cookie по имени из document.cookie. Используется для
     * извлечения CSRF-токена (его выставляет gateway в Set-Cookie).
     * @param name - имя cookie
     * @returns декодированное значение или пустая строка если cookie нет
     */
    #getCookie(name: string): string {
        const match = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(document.cookie);
        return match ? decodeURIComponent(match[1]) : '';
    }

    /**
     * Низкоуровневый метод выполнения HTTP-запроса. Все остальные (get/post/put/...)
     * — обёртки. Для не-GET/HEAD запросов: очищает GET-кэш и подставляет CSRF-токен.
     * Тело сериализуется в JSON если != null/undefined; иначе body=null.
     * @param method - HTTP-метод (GET/POST/PUT/DELETE/PATCH)
     * @param url - путь относительно baseUrl
     * @param data - тело запроса (опционально)
     * @returns промис Response от fetch
     */
    public request(method: string, url: string, data: unknown = null): Promise<Response> {
        if (method !== 'GET' && method !== 'HEAD') {
            this.#cache.clear();
        }
        const headers = { ...this.headers };
        if (method !== 'GET' && method !== 'HEAD') {
            const csrfToken = this.#getCookie('csrf_token');
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }
        }
        return fetch(this.baseUrl + url, {
            method,
            headers,
            body: data !== null && data !== undefined ? JSON.stringify(data) : null,
            credentials: 'include'
        });
    }
}
