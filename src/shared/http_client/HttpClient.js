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
     * @param {string} url
     * @param {FormData} formData
     * @returns {Promise<Response>}
     */
    upload(url, formData) {
        return fetch(this.baseUrl + url, {
            method: 'POST',
            body: formData,
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
