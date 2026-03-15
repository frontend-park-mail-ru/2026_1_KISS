/**
 * @module shared/http_client/HttpClient
 *
 * Обёртка над fetch для работы с JSON API.
 * Все запросы уходят на `/api/v1` текущего origin с credentials: 'include'.
 */

/**
 * HTTP-клиент для JSON API бэкенда.
 * Автоматически добавляет Content-Type и credentials к каждому запросу.
 */
export class HttpClient {
    /** @type {?HttpClient} */
    static #instance = null;

    /** @type {string} */
    baseUrl = `${window.location.origin}/api/v1`;

    /** @type {Object<string, string>} */
    headers = {
        'Content-Type': 'application/json'
    };

    constructor() {
        if (HttpClient.#instance) {
            throw new Error('Use HttpClient.getInstance() instead of new HttpClient()');
        }
        HttpClient.#instance = this;
    }

    /**
     * @returns {HttpClient}
     */
    static getInstance() {
        if (!HttpClient.#instance) {
            new HttpClient();
        }
        return HttpClient.#instance;
    }

    /**
     * @param {string} url -- путь относительно baseUrl
     * @returns {Promise<Response>}
     */
    get(url) {
        return this.request('GET', url);
    }

    /**
     * @param {string} url -- путь относительно baseUrl
     * @param {Object} data -- тело запроса (будет сериализовано в JSON)
     * @returns {Promise<Response>}
     */
    post(url, data) {
        return this.request('POST', url, data);
    }

    /**
     * @param {string} url -- путь относительно baseUrl
     * @param {Object} data -- тело запроса
     * @returns {Promise<Response>}
     */
    put(url, data) {
        return this.request('PUT', url, data);
    }

    /**
     * @param {string} url -- путь относительно baseUrl
     * @returns {Promise<Response>}
     */
    delete(url) {
        return this.request('DELETE', url);
    }

    /**
     * @param {string} url - API endpoint
     * @param {File} file - File object to upload
     * @param {string} [fieldName='avatar'] - form field name
     * @returns {Promise<Response>}
     */
    upload(url, file, fieldName = 'avatar') {
        const boundary = `----FormBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
        const safeName = file.name.replace(/["\r\n]/g, '_');
        const body = new Blob([
            `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${safeName}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
            file,
            `\r\n--${boundary}--\r\n`
        ]);

        return fetch(this.baseUrl + url, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: body,
            credentials: 'include'
        });
    }

    /**
     * Общий метод запроса. Сериализует data в JSON, если передан.
     *
     * @param {string} method -- HTTP-метод (GET, POST, PUT, DELETE)
     * @param {string} url -- путь относительно baseUrl
     * @param {?Object} [data=null] -- тело запроса
     * @returns {Promise<Response>}
     */
    request(method, url, data = null) {
        return fetch(this.baseUrl + url, {
            method: method,
            headers: this.headers,
            body: data ? JSON.stringify(data) : null,
            credentials: 'include'
        });
    }
}
