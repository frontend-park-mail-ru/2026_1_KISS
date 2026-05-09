import { HttpClient } from '../http_client/HttpClient.js';
import type { Comment } from '../types.js';
import type { ApiEnvelope } from './types.js';

export class NotebookApi {
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

    public async getComments(
        notebookId: number | string,
        blockId: number | string
    ): Promise<Comment[]> {
        const response = await this.#http.get(
            `/notebooks/${String(notebookId)}/blocks/${String(blockId)}/comments`
        );
        return this.#parse<Comment[]>(response);
    }

    public async addComment(
        notebookId: number | string,
        blockId: number | string,
        text: string
    ): Promise<Comment> {
        const response = await this.#http.post(
            `/notebooks/${String(notebookId)}/blocks/${String(blockId)}/comments`,
            { text }
        );
        return this.#parse<Comment>(response);
    }

    public async deleteComment(
        notebookId: number | string,
        blockId: number | string,
        commentId: number | string
    ): Promise<void> {
        const response = await this.#http.delete(
            `/notebooks/${String(notebookId)}/blocks/${String(blockId)}/comments/${String(commentId)}`
        );
        if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
    }
}
