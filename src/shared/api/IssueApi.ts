import { HttpClient } from '../http_client/HttpClient.js';
import type { ApiEnvelope, IssueDTO, IssueListResponse, IssueMessageDTO } from './types.js';

export class IssueApi {
    #http: HttpClient;

    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    async #parse<T>(response: Response): Promise<T> {
        const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
        if (!response.ok) {
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
        return body.data as T;
    }

    public async createIssue(
        category: string,
        content: string,
        files: File[] = []
    ): Promise<IssueDTO> {
        if (files.length === 0) {
            const response = await this.#http.post('/issues', { category, content });
            return this.#parse<IssueDTO>(response);
        }

        const formData = new FormData();
        formData.append('category', category);
        formData.append('content', content);
        files.forEach((file) => {
            formData.append('files', file);
        });

        const csrfToken = this.#getCookie('csrf_token');
        const headers: Record<string, string> = {};
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        const response = await fetch(`${this.#http.baseUrl}/issues`, {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include'
        });
        return this.#parse<IssueDTO>(response);
    }

    public async getIssues(): Promise<IssueListResponse> {
        const response = await this.#http.get('/issues');
        return this.#parse<IssueListResponse>(response);
    }

    public async getIssue(id: string | number): Promise<IssueDTO> {
        const response = await this.#http.get(`/issues/${String(id)}`);
        return this.#parse<IssueDTO>(response);
    }

    public async deleteIssue(id: string | number): Promise<null> {
        const response = await this.#http.delete(`/issues/${String(id)}`);
        return this.#parse<null>(response);
    }

    public getAttachmentUrl(issueId: string | number, attachmentId: string | number): string {
        return `${this.#http.baseUrl}/issues/${String(issueId)}/attachments/${String(attachmentId)}`;
    }

    public async addMessage(issueId: string | number, content: string): Promise<IssueMessageDTO> {
        const response = await this.#http.post(`/issues/${String(issueId)}/messages`, { content });
        return this.#parse<IssueMessageDTO>(response);
    }

    #getCookie(name: string): string {
        const match = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(document.cookie);
        return match ? decodeURIComponent(match[1]) : '';
    }
}
