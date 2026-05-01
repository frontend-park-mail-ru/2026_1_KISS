import { HttpClient } from '../http_client/HttpClient.js';

export interface UserStats {
    quota: {
        plan: string;
        total_time_seconds: number;
        time_limit_seconds: number;
        usage_percent: number;
    };
    activity: {
        last_active_at: string;
        created_at: string;
        daily_activity: { date: string; count: number }[];
    };
    resources: {
        notebook_count: number;
        block_count: number;
        total_executions: number;
    };
    storage: {
        total_files: number;
        total_size_bytes: number;
        files_by_category: Record<string, number>;
        size_by_category: Record<string, number>;
    };
}

export class StatsApi {
    #http: HttpClient;

    constructor() {
        this.#http = HttpClient.getInstance();
    }

    async getMyStats(): Promise<UserStats> {
        const response = await this.#http.get('/users/me/stats');
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
        return body.data;
    }
}
