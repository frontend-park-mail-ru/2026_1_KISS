export class HttpClient {
    static #instance: HttpClient | null = null;

    baseUrl = `${window.location.origin}/api/v1`;

    headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    #cache = new Map<string, { data: unknown; ts: number }>();
    #cacheTTL = 3000;

    constructor() {
        if (HttpClient.#instance) {
            throw new Error('Use HttpClient.getInstance() instead of new HttpClient()');
        }
        HttpClient.#instance = this;
    }

    static getInstance(): HttpClient {
        if (!HttpClient.#instance) {
            new HttpClient();
        }
        return HttpClient.#instance!;
    }

    get(url: string): Promise<Response> {
        const cached = this.#cache.get(url);
        if (cached && Date.now() - cached.ts < this.#cacheTTL) {
            return Promise.resolve(
                new Response(JSON.stringify(cached.data), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        }
        return this.request('GET', url).then(async (response) => {
            if (response.ok) {
                const data = await response.clone().json();
                this.#cache.set(url, { data, ts: Date.now() });
            }
            return response;
        });
    }

    post(url: string, data?: unknown): Promise<Response> {
        return this.request('POST', url, data);
    }

    put(url: string, data: unknown): Promise<Response> {
        return this.request('PUT', url, data);
    }

    delete(url: string): Promise<Response> {
        return this.request('DELETE', url);
    }

    patch(url: string, data: unknown): Promise<Response> {
        return this.request('PATCH', url, data);
    }

    upload(url: string, file: File, fieldName = 'avatar'): Promise<Response> {
        const boundary = `----FormBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
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
            body: body,
            credentials: 'include'
        });
    }

    #getCookie(name: string): string {
        const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
    }

    request(method: string, url: string, data: unknown = null): Promise<Response> {
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
            method: method,
            headers: headers,
            body: data ? JSON.stringify(data) : null,
            credentials: 'include'
        });
    }
}
