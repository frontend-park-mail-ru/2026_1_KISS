import { HttpClient } from '../http_client/HttpClient.js';
import type { ApiEnvelope, IssueDTO, IssueListResponse, IssueMessageDTO } from './types.js';

/**
 * API-клиент для работы с issues от лица обычного пользователя (/issues/*).
 * В отличие от AdminApi.getIssues — возвращает только свои issue.
 *
 * Поддерживает создание с прикреплёнными файлами через multipart/form-data
 * (когда files не пуст — посылает FormData; иначе обычный JSON).
 */
export class IssueApi {
    #http: HttpClient;

    /**
     * Берёт singleton HttpClient.
     */
    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    /**
     * Парсит JSON-ответ и проверяет ApiEnvelope.
     * @param response - объект Response
     * @returns распакованный body.data
     * @throws Error при HTTP не-2xx
     */
    async #parse<T>(response: Response): Promise<T> {
        const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
        if (!response.ok) {
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
        return body.data as T;
    }

    /**
     * Создаёт новый issue. Если переданы files — отправляет multipart/form-data
     * с файлами как 'files'; иначе обычный JSON. POST /issues.
     * @param category - категория issue ('bug', 'feature', 'support', ...)
     * @param content - первоначальный текст
     * @param files - прикреплённые файлы (опционально)
     * @returns промис с созданным issue
     */
    public async createIssue(
        category: string,
        content: string,
        files: File[] = []
    ): Promise<IssueDTO> {
        if (files.length === 0) {
            const response = await this.#http.post('/issues', { category, content });
            return this.#parse<IssueDTO>(response);
        }

        const formData = new FormData();
        formData.append('category', category);
        formData.append('content', content);
        files.forEach((file) => {
            formData.append('files', file);
        });

        const csrfToken = this.#getCookie('csrf_token');
        const headers: Record<string, string> = {};
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        const response = await fetch(`${this.#http.baseUrl}/issues`, {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include'
        });
        return this.#parse<IssueDTO>(response);
    }

    /**
     * Загружает свои issues. GET /issues.
     * @returns промис со списком своих issues
     */
    public async getIssues(): Promise<IssueListResponse> {
        const response = await this.#http.get('/issues');
        return this.#parse<IssueListResponse>(response);
    }

    /**
     * Загружает один свой issue со всеми сообщениями и вложениями.
     * GET /issues/:id.
     * @param id - ID issue
     * @returns промис с полным issue
     */
    public async getIssue(id: string | number): Promise<IssueDTO> {
        const response = await this.#http.get(`/issues/${String(id)}`);
        return this.#parse<IssueDTO>(response);
    }

    /**
     * Удаляет свой issue. DELETE /issues/:id.
     * @param id - ID issue
     * @returns промис с null
     */
    public async deleteIssue(id: string | number): Promise<null> {
        const response = await this.#http.delete(`/issues/${String(id)}`);
        return this.#parse<null>(response);
    }

    /**
     * Возвращает URL для скачивания вложения issue. Не делает HTTP-запрос —
     * только формирует строку URL. Для использования в `<a href="...">` или window.open.
     * @param issueId - ID issue
     * @param attachmentId - ID вложения
     * @returns полный URL для скачивания
     */
    public getAttachmentUrl(issueId: string | number, attachmentId: string | number): string {
        return `${this.#http.baseUrl}/issues/${String(issueId)}/attachments/${String(attachmentId)}`;
    }

    /**
     * Добавляет сообщение в тред issue. POST /issues/:id/messages.
     * @param issueId - ID issue
     * @param content - текст сообщения
     * @returns промис с созданным сообщением
     */
    public async addMessage(issueId: string | number, content: string): Promise<IssueMessageDTO> {
        const response = await this.#http.post(`/issues/${String(issueId)}/messages`, { content });
        return this.#parse<IssueMessageDTO>(response);
    }

    /**
     * Читает значение cookie по имени из document.cookie. Локальная копия
     * хелпера из HttpClient — для multipart-запросов где CSRF выставляется вручную.
     * @param name - имя cookie
     * @returns декодированное значение или пустая строка
     */
    #getCookie(name: string): string {
        const match = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(document.cookie);
        return match ? decodeURIComponent(match[1]) : '';
    }
}
