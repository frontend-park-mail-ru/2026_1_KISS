import { HttpClient } from '../http_client/HttpClient.js';
import type {
    AdminActivityStatsResponse,
    AdminNotebookListResponse,
    AdminStatsResponse,
    AdminUserListResponse,
    ApiEnvelope,
    IssueDTO,
    IssueListResponse,
    IssueStatsResponse,
    UserDTO
} from './types.js';

export class AdminApi {
    #http: HttpClient;

    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    async #parse<T>(response: Response): Promise<T> {
        const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
        if (!response.ok) {
            throw new Error(body.error ?? `HTTP ${response.status}`);
        }
        return body.data as T;
    }

    public async getUsers(limit = 20, offset = 0, search = ''): Promise<AdminUserListResponse> {
        const response = await this.#http.get(
            `/admin/users?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`
        );
        return this.#parse<AdminUserListResponse>(response);
    }

    public async banUser(id: string | number): Promise<null> {
        const response = await this.#http.post(`/admin/users/${id}/ban`);
        return this.#parse<null>(response);
    }

    public async unbanUser(id: string | number): Promise<null> {
        const response = await this.#http.post(`/admin/users/${id}/unban`);
        return this.#parse<null>(response);
    }

    public async updateUser(
        id: string | number,
        data: Record<string, unknown>
    ): Promise<UserDTO> {
        const response = await this.#http.put(`/admin/users/${id}`, data);
        return this.#parse<UserDTO>(response);
    }

    public async resetPassword(id: string | number, password: string): Promise<null> {
        const response = await this.#http.put(`/admin/users/${id}/password`, { password });
        return this.#parse<null>(response);
    }

    public async setPlan(id: string | number, plan: string): Promise<null> {
        const response = await this.#http.put(`/admin/users/${id}/plan`, { plan });
        return this.#parse<null>(response);
    }

    public async getNotebooks(
        limit = 20,
        offset = 0,
        search = ''
    ): Promise<AdminNotebookListResponse> {
        const response = await this.#http.get(
            `/admin/notebooks?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`
        );
        return this.#parse<AdminNotebookListResponse>(response);
    }

    public async deleteNotebook(id: string | number): Promise<null> {
        const response = await this.#http.delete(`/admin/notebooks/${id}`);
        return this.#parse<null>(response);
    }

    public async getStats(): Promise<AdminStatsResponse> {
        const response = await this.#http.get('/admin/stats');
        return this.#parse<AdminStatsResponse>(response);
    }

    public async getActivityStats(
        dauDays = 30,
        mauMonths = 12
    ): Promise<AdminActivityStatsResponse> {
        const response = await this.#http.get(
            `/admin/stats/activity?dau_days=${dauDays}&mau_months=${mauMonths}`
        );
        return this.#parse<AdminActivityStatsResponse>(response);
    }

    public async getIssues(
        limit = 20,
        offset = 0,
        search = '',
        userId: string | number | null = null
    ): Promise<IssueListResponse> {
        let url = `/admin/issues?limit=${limit}&offset=${offset}`;
        if (search) {
            url += `&q=${encodeURIComponent(search)}`;
        }
        if (userId !== null) {
            url += `&userid=${userId}`;
        }
        const response = await this.#http.get(url);
        return this.#parse<IssueListResponse>(response);
    }

    public async getIssue(id: string | number): Promise<IssueDTO> {
        const response = await this.#http.get(`/admin/issues/${id}`);
        return this.#parse<IssueDTO>(response);
    }

    public async updateIssueStatus(id: string | number, status: string): Promise<IssueDTO> {
        const response = await this.#http.patch(`/admin/issues/${id}/status`, { status });
        return this.#parse<IssueDTO>(response);
    }

    public async respondToIssue(id: string | number, text: string): Promise<IssueDTO> {
        const response = await this.#http.post(`/admin/issues/${id}/response`, {
            content: text
        });
        return this.#parse<IssueDTO>(response);
    }

    public async getIssueStats(): Promise<IssueStatsResponse> {
        const response = await this.#http.get('/admin/issues/stats');
        return this.#parse<IssueStatsResponse>(response);
    }

    public async sendEmail(to: string, subject: string, body: string): Promise<null> {
        const response = await this.#http.post('/admin/send-email', { to, subject, body });
        return this.#parse<null>(response);
    }
}
