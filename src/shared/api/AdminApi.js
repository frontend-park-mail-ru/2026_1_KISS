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

    async updateUser(id, data) {
        const response = await this.#http.put(`/admin/users/${id}`, data);
        return this.#parse(response);
    }

    async resetPassword(id, password) {
        const response = await this.#http.put(`/admin/users/${id}/password`, { password });
        return this.#parse(response);
    }

    async setPlan(id, plan) {
        const response = await this.#http.put(`/admin/users/${id}/plan`, { plan });
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

    async getActivityStats(dauDays = 30, mauMonths = 12) {
        const response = await this.#http.get(
            `/admin/stats/activity?dau_days=${dauDays}&mau_months=${mauMonths}`
        );
        return this.#parse(response);
    }
}
