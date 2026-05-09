import { HttpClient } from '../http_client/HttpClient.js';
import type { Comment } from '../types.js';

export class NotebookApi {
    #http: HttpClient;

    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    async #parse(response: Response): Promise<unknown> {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body?.error || `HTTP ${response.status}`);
        }
        return body.data;
    }

    public async getComments(notebookId: number | string, blockId: number | string): Promise<Comment[]> {
        const response = await this.#http.get(
            `/notebooks/${notebookId}/blocks/${blockId}/comments`
        );
        return this.#parse(response) as Promise<Comment[]>;
    }

    public async addComment(
        notebookId: number | string,
        blockId: number | string,
        text: string
    ): Promise<Comment> {
        const response = await this.#http.post(
            `/notebooks/${notebookId}/blocks/${blockId}/comments`,
            { text }
        );
        return this.#parse(response) as Promise<Comment>;
    }

    public async deleteComment(
        notebookId: number | string,
        blockId: number | string,
        commentId: number | string
    ): Promise<void> {
        const response = await this.#http.delete(
            `/notebooks/${notebookId}/blocks/${blockId}/comments/${commentId}`
        );
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.error || `HTTP ${response.status}`);
        }
    }
}
