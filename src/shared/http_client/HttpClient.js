export class HttpClient {
    static #instance = null;

    baseUrl = `${window.location.origin}/api/v1`;
    headers = {
        'Content-Type': 'application/json'
    };

    constructor() {
        if (HttpClient.#instance) {
            throw new Error('Use HttpClient.getInstance() instead of new HttpClient()');
        }
        HttpClient.#instance = this;
    }

    static getInstance() {
        if (!HttpClient.#instance) {
            new HttpClient();
        }
        return HttpClient.#instance;
    }

    get(url) {
        return this.request('GET', url);
    }

    post(url, data) {
        return this.request('POST', url, data);
    }

    put(url, data) {
        return this.request('PUT', url, data);
    }

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

    request(method, url, data = null) {
        return fetch(this.baseUrl + url, {
            method: method,
            headers: this.headers,
            body: data ? JSON.stringify(data) : null,
            credentials: 'include'
        });
    }
}
