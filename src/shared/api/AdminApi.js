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

    async getIssues(limit = 20, offset = 0, search = '', userId = null) {
        let url = `/admin/issues?limit=${limit}&offset=${offset}`;
        if (search) url += `&q=${encodeURIComponent(search)}`;
        if (userId) url += `&userid=${userId}`;
        const response = await this.#http.get(url);
        return this.#parse(response);
    }

    async getIssue(id) {
        const response = await this.#http.get(`/admin/issues/${id}`);
        return this.#parse(response);
    }

    async updateIssueStatus(id, status) {
        const response = await this.#http.patch(`/admin/issues/${id}/status`, { status });
        return this.#parse(response);
    }

    async respondToIssue(id, text) {
        const response = await this.#http.post(`/admin/issues/${id}/response`, {
            response: text
        });
        return this.#parse(response);
    }
}
