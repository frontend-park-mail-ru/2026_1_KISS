import { HttpClient } from '../http_client/HttpClient.js';
import type { ApiEnvelope, ContainerStatsDTO, ExecutionResultDTO } from './types.js';

interface FastApiValidationDetail {
    msg?: string;
}

interface FastApiValidationError {
    detail?: FastApiValidationDetail[];
}

export class RunnerApi {
    #http: HttpClient;

    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    async #parse<T>(response: Response): Promise<T> {
        const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
        if (!response.ok) {
            const err = body.error ?? `HTTP ${String(response.status)}`;
            throw new Error(this.#formatError(err));
        }
        return body.data as T;
    }

    #formatError(raw: string): string {
        const jsonMatch = /:\s*(\{.+\})\s*$/s.exec(raw);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]) as FastApiValidationError;
                if (Array.isArray(parsed.detail) && parsed.detail.length > 0) {
                    return parsed.detail
                        .map((d) => d.msg)
                        .filter(Boolean)
                        .join('; ');
                }
            } catch {
                /* fallback */
            }
        }
        return raw;
    }

    public async executeBlock(
        notebookId: number | string,
        blockPosition: number
    ): Promise<ExecutionResultDTO> {
        const response = await this.#http.post(
            `/runner/${String(notebookId)}/block?block_position=${String(blockPosition)}`
        );
        return this.#parse<ExecutionResultDTO>(response);
    }

    public async executeFromPosition(
        notebookId: number | string,
        startPosition = 0
    ): Promise<ExecutionResultDTO[]> {
        const response = await this.#http.post(
            `/runner/${String(notebookId)}?block_position=${String(startPosition)}`
        );
        return this.#parse<ExecutionResultDTO[]>(response);
    }

    public stopSession(notebookId: number | string): Promise<void> {
        try {
            return this.#http.post(`/runner/${String(notebookId)}/stop`).then(
                () => undefined,
                () => undefined
            );
        } catch {
            return Promise.resolve();
        }
    }

    public stopSessionBeacon(notebookId: number | string): void {
        if (typeof navigator !== 'undefined') {
            navigator.sendBeacon(`/api/v1/runner/${String(notebookId)}/stop`);
        }
    }

    public async getContainerStats(notebookId: number | string): Promise<ContainerStatsDTO> {
        const response = await this.#http.get(`/runner/${String(notebookId)}/stats`);
        return this.#parse<ContainerStatsDTO>(response);
    }
}
