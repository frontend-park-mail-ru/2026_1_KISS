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

/**
 * API-клиент админ-панели (/admin/*). Доступен только пользователям с is_admin=true;
 * gateway отбрасывает запросы с 403 для остальных.
 *
 * Покрывает: управление пользователями (ban/unban/edit/reset password/plan),
 * управление notebook'ами (delete), общую статистику (DAU/MAU/totals),
 * issues (список/детали/смена статуса/ответ от админа), email-рассылку.
 */
export class AdminApi {
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
     * Постранично загружает пользователей с фильтром поиска (по логину/email).
     * GET /admin/users.
     * @param limit - размер страницы
     * @param offset - смещение страницы
     * @param search - подстрока для поиска (пустая = без фильтра)
     * @returns промис со списком пользователей и общим количеством
     */
    public async getUsers(limit = 20, offset = 0, search = ''): Promise<AdminUserListResponse> {
        const response = await this.#http.get(
            `/admin/users?limit=${String(limit)}&offset=${String(offset)}&search=${encodeURIComponent(search)}`
        );
        return this.#parse<AdminUserListResponse>(response);
    }

    /**
     * Блокирует пользователя — он не сможет залогиниться. POST /admin/users/:id/ban.
     * @param id - ID пользователя
     * @returns промис с null (без полезной нагрузки)
     */
    public async banUser(id: string | number): Promise<null> {
        const response = await this.#http.post(`/admin/users/${String(id)}/ban`);
        return this.#parse<null>(response);
    }

    /**
     * Снимает блокировку с пользователя. POST /admin/users/:id/unban.
     * @param id - ID пользователя
     * @returns промис с null
     */
    public async unbanUser(id: string | number): Promise<null> {
        const response = await this.#http.post(`/admin/users/${String(id)}/unban`);
        return this.#parse<null>(response);
    }

    /**
     * Обновляет произвольные поля пользователя (username/email/status/...).
     * PUT /admin/users/:id.
     * @param id - ID пользователя
     * @param data - частичный объект полей для обновления
     * @returns промис с обновлённым пользователем
     */
    public async updateUser(id: string | number, data: Record<string, unknown>): Promise<UserDTO> {
        const response = await this.#http.put(`/admin/users/${String(id)}`, data);
        return this.#parse<UserDTO>(response);
    }

    /**
     * Принудительно сбрасывает пароль пользователя на заданный.
     * PUT /admin/users/:id/password.
     * @param id - ID пользователя
     * @param password - новый пароль (плейн-текст; бэкенд хеширует)
     * @returns промис с null
     */
    public async resetPassword(id: string | number, password: string): Promise<null> {
        const response = await this.#http.put(`/admin/users/${String(id)}/password`, { password });
        return this.#parse<null>(response);
    }

    /**
     * Меняет тарифный план пользователя. PUT /admin/users/:id/plan.
     * @param id - ID пользователя
     * @param plan - идентификатор плана ('free', 'pro', ...)
     * @returns промис с null
     */
    public async setPlan(id: string | number, plan: string): Promise<null> {
        const response = await this.#http.put(`/admin/users/${String(id)}/plan`, { plan });
        return this.#parse<null>(response);
    }

    /**
     * Постранично загружает notebook'и для админ-обзора (без блоков).
     * GET /admin/notebooks.
     * @param limit - размер страницы
     * @param offset - смещение страницы
     * @param search - подстрока для поиска по title
     * @returns промис со списком notebook'ов
     */
    public async getNotebooks(
        limit = 20,
        offset = 0,
        search = ''
    ): Promise<AdminNotebookListResponse> {
        const response = await this.#http.get(
            `/admin/notebooks?limit=${String(limit)}&offset=${String(offset)}&search=${encodeURIComponent(search)}`
        );
        return this.#parse<AdminNotebookListResponse>(response);
    }

    /**
     * Удаляет notebook без подтверждения владельца. DELETE /admin/notebooks/:id.
     * @param id - ID notebook'а
     * @returns промис с null
     */
    public async deleteNotebook(id: string | number): Promise<null> {
        const response = await this.#http.delete(`/admin/notebooks/${String(id)}`);
        return this.#parse<null>(response);
    }

    /**
     * Загружает агрегированную статистику для дашборда (totals + DAU/MAU snapshot).
     * GET /admin/stats.
     * @returns промис со статистикой
     */
    public async getStats(): Promise<AdminStatsResponse> {
        const response = await this.#http.get('/admin/stats');
        return this.#parse<AdminStatsResponse>(response);
    }

    /**
     * Загружает временные ряды активности (DAU за N дней, MAU за M месяцев)
     * для построения графиков. GET /admin/stats/activity.
     * @param dauDays - сколько дней DAU вернуть (default 30)
     * @param mauMonths - сколько месяцев MAU вернуть (default 12)
     * @returns промис с рядами DAU и MAU
     */
    public async getActivityStats(
        dauDays = 30,
        mauMonths = 12
    ): Promise<AdminActivityStatsResponse> {
        const response = await this.#http.get(
            `/admin/stats/activity?dau_days=${String(dauDays)}&mau_months=${String(mauMonths)}`
        );
        return this.#parse<AdminActivityStatsResponse>(response);
    }

    /**
     * Постранично загружает issues с фильтром по поисковой строке и/или userId.
     * GET /admin/issues.
     * @param limit - размер страницы
     * @param offset - смещение страницы
     * @param search - подстрока для поиска по content
     * @param userId - фильтр по конкретному пользователю (null — все)
     * @returns промис со списком issues
     */
    public async getIssues(
        limit = 20,
        offset = 0,
        search = '',
        userId: string | number | null = null
    ): Promise<IssueListResponse> {
        let url = `/admin/issues?limit=${String(limit)}&offset=${String(offset)}`;
        if (search) {
            url += `&q=${encodeURIComponent(search)}`;
        }
        if (userId !== null) {
            url += `&userid=${String(userId)}`;
        }
        const response = await this.#http.get(url);
        return this.#parse<IssueListResponse>(response);
    }

    /**
     * Загружает один issue со всеми сообщениями и вложениями.
     * GET /admin/issues/:id.
     * @param id - ID issue
     * @returns промис с полным issue
     */
    public async getIssue(id: string | number): Promise<IssueDTO> {
        const response = await this.#http.get(`/admin/issues/${String(id)}`);
        return this.#parse<IssueDTO>(response);
    }

    /**
     * Меняет статус issue ('open'/'in_progress'/'closed').
     * PATCH /admin/issues/:id/status.
     * @param id - ID issue
     * @param status - новый статус
     * @returns промис с обновлённым issue
     */
    public async updateIssueStatus(id: string | number, status: string): Promise<IssueDTO> {
        const response = await this.#http.patch(`/admin/issues/${String(id)}/status`, { status });
        return this.#parse<IssueDTO>(response);
    }

    /**
     * Добавляет ответ администратора в тред issue.
     * POST /admin/issues/:id/response.
     * @param id - ID issue
     * @param text - текст ответа
     * @returns промис с обновлённым issue (с новым сообщением в треде)
     */
    public async respondToIssue(id: string | number, text: string): Promise<IssueDTO> {
        const response = await this.#http.post(`/admin/issues/${String(id)}/response`, {
            content: text
        });
        return this.#parse<IssueDTO>(response);
    }

    /**
     * Загружает статистику issues (агрегаты по статусу и категории).
     * GET /admin/issues/stats.
     * @returns промис со статистикой
     */
    public async getIssueStats(): Promise<IssueStatsResponse> {
        const response = await this.#http.get('/admin/issues/stats');
        return this.#parse<IssueStatsResponse>(response);
    }

    /**
     * Отправляет email пользователю напрямую через бэкенд.
     * POST /admin/send-email.
     * @param to - email получателя
     * @param subject - тема письма
     * @param body - тело письма (plain-text)
     * @returns промис с null
     */
    public async sendEmail(to: string, subject: string, body: string): Promise<null> {
        const response = await this.#http.post('/admin/send-email', { to, subject, body });
        return this.#parse<null>(response);
    }
}
