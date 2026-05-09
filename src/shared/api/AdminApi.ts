import { HttpClient } from '../http_client/HttpClient.js';

export class AdminApi {
    #http: HttpClient;

    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    async #parse(response: Response): Promise<unknown> {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body?.error ?? `HTTP ${response.status}`);
        }
        return body.data;
    }

    public async getUsers(limit = 20, offset = 0, search = ''): Promise<unknown> {
        const response = await this.#http.get(
            `/admin/users?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`
        );
        return this.#parse(response);
    }

    public async banUser(id: string | number): Promise<unknown> {
        const response = await this.#http.post(`/admin/users/${id}/ban`);
        return this.#parse(response);
    }

    public async unbanUser(id: string | number): Promise<unknown> {
        const response = await this.#http.post(`/admin/users/${id}/unban`);
        return this.#parse(response);
    }

    public async updateUser(id: string | number, data: Record<string, unknown>): Promise<unknown> {
        const response = await this.#http.put(`/admin/users/${id}`, data);
        return this.#parse(response);
    }

    public async resetPassword(id: string | number, password: string): Promise<unknown> {
        const response = await this.#http.put(`/admin/users/${id}/password`, { password });
        return this.#parse(response);
    }

    public async setPlan(id: string | number, plan: string): Promise<unknown> {
        const response = await this.#http.put(`/admin/users/${id}/plan`, { plan });
        return this.#parse(response);
    }

    public async getNotebooks(limit = 20, offset = 0, search = ''): Promise<unknown> {
        const response = await this.#http.get(
            `/admin/notebooks?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`
        );
        return this.#parse(response);
    }

    public async deleteNotebook(id: string | number): Promise<unknown> {
        const response = await this.#http.delete(`/admin/notebooks/${id}`);
        return this.#parse(response);
    }

    public async getStats(): Promise<unknown> {
        const response = await this.#http.get('/admin/stats');
        return this.#parse(response);
    }

    public async getActivityStats(dauDays = 30, mauMonths = 12): Promise<unknown> {
        const response = await this.#http.get(
            `/admin/stats/activity?dau_days=${dauDays}&mau_months=${mauMonths}`
        );
        return this.#parse(response);
    }

    public async getIssues(
        limit = 20,
        offset = 0,
        search = '',
        userId: string | number | null = null
    ): Promise<unknown> {
        let url = `/admin/issues?limit=${limit}&offset=${offset}`;
        if (search) url += `&q=${encodeURIComponent(search)}`;
        if (userId !== null) url += `&userid=${userId}`;
        const response = await this.#http.get(url);
        return this.#parse(response);
    }

    public async getIssue(id: string | number): Promise<unknown> {
        const response = await this.#http.get(`/admin/issues/${id}`);
        return this.#parse(response);
    }

    public async updateIssueStatus(id: string | number, status: string): Promise<unknown> {
        const response = await this.#http.patch(`/admin/issues/${id}/status`, { status });
        return this.#parse(response);
    }

    public async respondToIssue(id: string | number, text: string): Promise<unknown> {
        const response = await this.#http.post(`/admin/issues/${id}/response`, {
            content: text
        });
        return this.#parse(response);
    }

    public async getIssueStats(): Promise<unknown> {
        const response = await this.#http.get('/admin/issues/stats');
        return this.#parse(response);
    }

    public async sendEmail(to: string, subject: string, body: string): Promise<unknown> {
        const response = await this.#http.post('/admin/send-email', { to, subject, body });
        return this.#parse(response);
    }
}
