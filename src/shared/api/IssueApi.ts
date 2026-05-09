import { HttpClient } from '../http_client/HttpClient.js';

export class IssueApi {
    #http: HttpClient;

    constructor() {
        this.#http = HttpClient.getInstance();
    }

    async #parse(response: Response): Promise<unknown> {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body?.error || `HTTP ${response.status}`);
        }
        return body.data;
    }

    async createIssue(category: string, content: string, files: File[] = []): Promise<unknown> {
        if (files.length === 0) {
            const response = await this.#http.post('/issues', { category, content });
            return this.#parse(response);
        }

        const formData = new FormData();
        formData.append('category', category);
        formData.append('content', content);
        files.forEach((file) => { formData.append('files', file); });

        const csrfToken = this.#getCookie('csrf_token');
        const headers: Record<string, string> = {};
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        const response = await fetch(`${this.#http.baseUrl  }/issues`, {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include'
        });
        return this.#parse(response);
    }

    async getIssues(): Promise<unknown> {
        const response = await this.#http.get('/issues');
        return this.#parse(response);
    }

    async getIssue(id: string | number): Promise<unknown> {
        const response = await this.#http.get(`/issues/${id}`);
        return this.#parse(response);
    }

    async deleteIssue(id: string | number): Promise<unknown> {
        const response = await this.#http.delete(`/issues/${id}`);
        return this.#parse(response);
    }

    getAttachmentUrl(issueId: string | number, attachmentId: string | number): string {
        return `${this.#http.baseUrl}/issues/${issueId}/attachments/${attachmentId}`;
    }

    async addMessage(issueId: string | number, content: string): Promise<unknown> {
        const response = await this.#http.post(`/issues/${issueId}/messages`, { content });
        return this.#parse(response);
    }

    #getCookie(name: string): string {
        const match = new RegExp(`(?:^|; )${  name  }=([^;]*)`).exec(document.cookie);
        return match ? decodeURIComponent(match[1]) : '';
    }
}
