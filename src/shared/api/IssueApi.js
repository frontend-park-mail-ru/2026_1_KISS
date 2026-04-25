import { HttpClient } from '../http_client/HttpClient.js';

export class IssueApi {
    #http;

    constructor() {
        this.#http = HttpClient.getInstance();
    }

    async #parse(response) {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body?.error || `HTTP ${response.status}`);
        }
        return body.data;
    }

    async createIssue(category, content, files = []) {
        if (files.length === 0) {
            const response = await this.#http.post('/issues', { category, content });
            return this.#parse(response);
        }

        const formData = new FormData();
        formData.append('category', category);
        formData.append('content', content);
        files.forEach((file) => formData.append('files', file));

        const csrfToken = this.#getCookie('csrf_token');
        const headers = {};
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        const response = await fetch(this.#http.baseUrl + '/issues', {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include'
        });
        return this.#parse(response);
    }

    async getIssues() {
        const response = await this.#http.get('/issues');
        return this.#parse(response);
    }

    async getIssue(id) {
        const response = await this.#http.get(`/issues/${id}`);
        return this.#parse(response);
    }

    getAttachmentUrl(issueId, attachmentId) {
        return `${this.#http.baseUrl}/issues/${issueId}/attachments/${attachmentId}`;
    }

    async addMessage(issueId, content) {
        const response = await this.#http.post(`/issues/${issueId}/messages`, { content });
        return this.#parse(response);
    }

    #getCookie(name) {
        const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
    }
}
