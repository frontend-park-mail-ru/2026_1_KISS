import { HttpClient } from '../http_client/HttpClient.js';

/**
 * Тонкая обёртка над HttpClient для runner-эндпоинтов.
 * Все методы возвращают распакованный `data` из envelope `{data, error}`.
 */
export class RunnerApi {
    #http;

    constructor() {
        this.#http = HttpClient.getInstance();
    }

    /**
     * @param {Response} response
     * @returns {Promise<*>}
     */
    async #parse(response) {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const err = body?.error || `HTTP ${response.status}`;
            throw new Error(err);
        }
        return body.data;
    }

    /**
     * Исполнить один блок по позиции.
     * @param {number|string} notebookId
     * @param {number} blockPosition
     * @returns {Promise<object>} BlockExecutionResult
     */
    async executeBlock(notebookId, blockPosition) {
        const response = await this.#http.get(
            `/runner/${notebookId}/block?block_position=${blockPosition}`
        );
        return this.#parse(response);
    }

    /**
     * Исполнить все блоки начиная с позиции.
     * @param {number|string} notebookId
     * @param {number} startPosition
     * @returns {Promise<object[]>} BlockExecutionResult[]
     */
    async executeFromPosition(notebookId, startPosition = 0) {
        const response = await this.#http.get(
            `/runner/${notebookId}?block_position=${startPosition}`
        );
        return this.#parse(response);
    }

    /**
     * Остановить runner-сессию (fire-and-forget, ошибки глотаются).
     * @param {number|string} notebookId
     */
    stopSession(notebookId) {
        try {
            return this.#http.get(`/runner/${notebookId}/stop`).catch(() => {});
        } catch {
            return Promise.resolve();
        }
    }

    /**
     * Синхронная остановка сессии через sendBeacon для beforeunload.
     * @param {number|string} notebookId
     */
    stopSessionBeacon(notebookId) {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon(`/api/v1/runner/${notebookId}/stop`);
        }
    }
}
