export class HttpClient {
    baseUrl = `${window.location.origin}/api/v1`;
    headers = {
        'Content-Type': 'application/json'
    };
    constructor() {}

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

    request(method, url, data = null) {
        return fetch(this.baseUrl + url, {
            method: method,
            headers: this.headers,
            body: data ? JSON.stringify(data) : null,
            credentials: 'include'
        });
    }
}
