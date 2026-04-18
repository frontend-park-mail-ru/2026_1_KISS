import { HttpClient } from '../http_client/HttpClient.js';

export class AdminApi {
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

    async getUsers(limit = 20, offset = 0, search = '') {
        const response = await this.#http.get(
            `/admin/users?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`
        );
        return this.#parse(response);
    }

    async banUser(id) {
        const response = await this.#http.post(`/admin/users/${id}/ban`);
        return this.#parse(response);
    }

    async unbanUser(id) {
        const response = await this.#http.post(`/admin/users/${id}/unban`);
        return this.#parse(response);
    }

    async getNotebooks(limit = 20, offset = 0, search = '') {
        const response = await this.#http.get(
            `/admin/notebooks?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`
        );
        return this.#parse(response);
    }

    async deleteNotebook(id) {
        const response = await this.#http.delete(`/admin/notebooks/${id}`);
        return this.#parse(response);
    }

    async getStats() {
        const response = await this.#http.get('/admin/stats');
        return this.#parse(response);
    }
}
