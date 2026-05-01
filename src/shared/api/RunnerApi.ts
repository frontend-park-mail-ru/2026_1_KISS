import { HttpClient } from '../http_client/HttpClient.js';

export class RunnerApi {
    #http: HttpClient;

    constructor() {
        this.#http = HttpClient.getInstance();
    }

    async #parse(response: Response): Promise<unknown> {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const err = body?.error || `HTTP ${response.status}`;
            throw new Error(this.#formatError(err));
        }
        return body.data;
    }

    #formatError(raw: string): string {
        const jsonMatch = raw.match(/:\s*(\{.+\})\s*$/s);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (Array.isArray(parsed.detail) && parsed.detail.length > 0) {
                    return parsed.detail
                        .map((d: { msg?: string }) => d.msg)
                        .filter(Boolean)
                        .join('; ');
                }
            } catch {
                /* fallback */
            }
        }
        return raw;
    }

    async executeBlock(notebookId: number | string, blockPosition: number): Promise<unknown> {
        const response = await this.#http.post(
            `/runner/${notebookId}/block?block_position=${blockPosition}`
        );
        return this.#parse(response);
    }

    async executeFromPosition(notebookId: number | string, startPosition = 0): Promise<unknown> {
        const response = await this.#http.post(
            `/runner/${notebookId}?block_position=${startPosition}`
        );
        return this.#parse(response);
    }

    stopSession(notebookId: number | string): Promise<void> {
        try {
            return this.#http.post(`/runner/${notebookId}/stop`).catch(() => {}) as Promise<void>;
        } catch {
            return Promise.resolve();
        }
    }

    stopSessionBeacon(notebookId: number | string): void {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon(`/api/v1/runner/${notebookId}/stop`);
        }
    }

    async getContainerStats(notebookId: number | string): Promise<{
        cpu_percent: number;
        memory_usage: number;
        memory_limit: number;
        memory_percent: number;
    }> {
        const response = await this.#http.get(`/runner/${notebookId}/stats`);
        return this.#parse(response) as Promise<{
            cpu_percent: number;
            memory_usage: number;
            memory_limit: number;
            memory_percent: number;
        }>;
    }
}
