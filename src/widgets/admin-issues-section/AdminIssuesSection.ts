import { AdminApi } from '../../shared/api/AdminApi.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { logError } from '../../shared/utils/logger.js';
import { nn } from '../../shared/utils/notNull.js';
import {
    ISSUE_CATEGORY_BADGES,
    ISSUE_STATUS_BADGES,
    ISSUE_STATUS_OPTIONS,
    plural,
    renderPagination,
    type BadgeDescriptor
} from '../admin-shared/admin-helpers.js';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;
const PREVIEW_LENGTH = 60;

/**
 * Виджет секции "Обращения" в админке. Содержит две view'хи: список с
 * фильтрацией/пагинацией и детальный вид с цепочкой сообщений, формой
 * смены статуса и формой ответа. Переключается между ними внутренне
 * (без участия родительской страницы).
 *
 * Заменяет ~290 строк в AdminPage (#initIssuesSection +
 * #refreshIssuesTable + #showIssueDetail + #issueBadge).
 */
export class AdminIssuesSection {
    #parent: HTMLElement;
    #api: AdminApi;
    #currentPage = 1;
    #currentSearch = '';
    #searchTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Сохраняет родительский элемент и инициализирует AdminApi.
     * @param parent - элемент, в который будет вставлен контент секции
     */
    public constructor(parent: HTMLElement) {
        this.#parent = parent;
        this.#api = new AdminApi();
    }

    /**
     * Рендерит view-список обращений.
     */
    public mount(): void {
        this.#renderList();
    }

    /**
     * Очищает родительский элемент и таймер поиска.
     */
    public unmount(): void {
        if (this.#searchTimeout !== null) clearTimeout(this.#searchTimeout);
        this.#parent.innerHTML = '';
    }

    /**
     * Рендерит структуру списка обращений (заголовок + поиск + таблица).
     */
    #renderList(): void {
        this.#parent.innerHTML = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Обращения';
        this.#parent.appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по содержанию...';
        searchInput.addEventListener('input', () => {
            if (this.#searchTimeout !== null) clearTimeout(this.#searchTimeout);
            this.#searchTimeout = setTimeout(() => {
                this.#currentSearch = searchInput.value;
                this.#currentPage = 1;
                void this.#refreshTable();
            }, SEARCH_DEBOUNCE_MS);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'issue-count';
        header.appendChild(countEl);
        this.#parent.appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        this.#parent.appendChild(tableContainer);

        void this.#refreshTable();
    }

    /**
     * Перезагружает таблицу обращений.
     */
    async #refreshTable(): Promise<void> {
        const tableContainer = this.#parent.querySelector('.admin-table-container');
        const countEl = this.#parent.querySelector('[data-role="issue-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const offset = (this.#currentPage - 1) * PAGE_SIZE;

        try {
            const data = await this.#api.getIssues(PAGE_SIZE, offset, this.#currentSearch);
            const issues = data.issues as unknown as Record<string, unknown>[];
            const total = data.total;
            if (countEl) {
                countEl.textContent = `${String(total)} обращени${plural(total, 'е', 'я', 'й')}`;
            }

            if (issues.length === 0) {
                tableContainer.innerHTML = '<div class="admin-empty">Обращения не найдены</div>';
                return;
            }

            tableContainer.appendChild(this.#buildTable(issues));

            const totalPages = Math.ceil(total / PAGE_SIZE);
            if (totalPages > 1) {
                renderPagination(
                    tableContainer as HTMLElement,
                    this.#currentPage,
                    totalPages,
                    (p: number) => {
                        this.#currentPage = p;
                        void this.#refreshTable();
                    }
                );
            }
        } catch (e: unknown) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${escapeHtml((e as Error).message)}</div>`;
        }
    }

    /**
     * Строит HTML-таблицу обращений с клик-обработчиками для открытия деталей.
     * @param issues - массив issues от API
     * @returns готовая таблица
     */
    #buildTable(issues: Record<string, unknown>[]): HTMLTableElement {
        const table = document.createElement('table');
        table.className = 'admin-table';
        table.innerHTML = `<colgroup>
            <col style="width:50px"><col style="width:100px"><col style="width:40%">
            <col style="width:80px"><col style="width:90px"><col style="width:110px">
        </colgroup>
        <thead><tr>
            <th>ID</th><th>Категория</th><th>Содержание</th>
            <th>User ID</th><th>Статус</th><th>Дата</th>
        </tr></thead>`;

        const tbody = document.createElement('tbody');
        issues.forEach((issue) => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            const catBadge = this.#issueBadge(ISSUE_CATEGORY_BADGES, issue.category as string);
            const statusBadge = this.#issueBadge(ISSUE_STATUS_BADGES, issue.status as string);
            const content = issue.content as string;
            const preview =
                content.length > PREVIEW_LENGTH
                    ? `${content.substring(0, PREVIEW_LENGTH)}...`
                    : content;

            tr.innerHTML = `
                <td class="admin-table__muted">${String(issue.id)}</td>
                <td>${catBadge}</td>
                <td class="admin-table__cell-truncate" title="${escapeHtml(content)}">${escapeHtml(preview)}</td>
                <td class="admin-table__muted">${String(issue.user_id)}</td>
                <td>${statusBadge}</td>
                <td class="admin-table__muted">${new Date(issue.created_at as string).toLocaleDateString('ru-RU')}</td>`;

            tr.addEventListener('click', () => {
                void this.#showDetail(issue.id as number);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    /**
     * Открывает детальный вид обращения: цепочка сообщений, форма смены
     * статуса, форма ответа. Кнопка "Назад" возвращает в список.
     * @param issueId - идентификатор обращения
     */
    async #showDetail(issueId: number): Promise<void> {
        this.#parent.innerHTML = '';

        const backBtn = document.createElement('button');
        backBtn.className = 'admin-issue-detail__back-btn';
        backBtn.innerHTML = '&larr; Назад к обращениям';
        backBtn.addEventListener('click', () => {
            this.#renderList();
        });
        this.#parent.appendChild(backBtn);

        const container = document.createElement('div');
        container.className = 'admin-issue-detail';
        container.innerHTML = '<div class="admin-empty">Загрузка...</div>';
        this.#parent.appendChild(container);

        try {
            const issue = (await this.#api.getIssue(issueId)) as unknown as Record<string, unknown>;
            container.innerHTML = this.#renderDetailHtml(issueId, issue);
            this.#wireDetailActions(container, issueId);
        } catch (e: unknown) {
            container.innerHTML = `<div class="admin-empty">Ошибка: ${escapeHtml((e as Error).message)}</div>`;
        }
    }

    /**
     * Строит HTML детального вида обращения (без обработчиков событий).
     * @param issueId - ID обращения для заголовка
     * @param issue - полное представление issue от API
     * @returns HTML-строка для вставки в container.innerHTML
     */
    #renderDetailHtml(issueId: number, issue: Record<string, unknown>): string {
        const catBadge = this.#issueBadge(ISSUE_CATEGORY_BADGES, issue.category as string);
        const statusBadge = this.#issueBadge(ISSUE_STATUS_BADGES, issue.status as string);
        const date = this.#formatDateTime(issue.created_at as string);

        const attachments = issue.attachments as Record<string, unknown>[] | undefined;
        const attachmentsHtml = this.#buildAttachmentsHtml(issueId, attachments);

        const messages = issue.messages as Record<string, unknown>[] | undefined;
        const messagesHtml = this.#buildMessagesHtml(messages);

        return `
            <h2 class="admin-page__section-title">Обращение #${String(issue.id)}</h2>
            <div class="admin-issue-detail__meta">
                ${catBadge} ${statusBadge}
                <span class="admin-table__muted">${escapeHtml(issue.username ?? `User #${String(issue.user_id)}`)}</span>
                <span class="admin-table__muted">${date}</span>
            </div>
            <div class="admin-issue-detail__content">${escapeHtml(issue.content)}</div>
            ${attachmentsHtml}
            ${messagesHtml}
            <div class="admin-issue-detail__actions">
                <div class="admin-issue-detail__status-row">
                    <label class="admin-issue-detail__section-title">Статус</label>
                    <select class="admin-search" data-role="status-select">
                        ${ISSUE_STATUS_OPTIONS.map(
                            (opt) =>
                                `<option value="${opt.value}" ${opt.value === issue.status ? 'selected' : ''}>${opt.label}</option>`
                        ).join('')}
                    </select>
                    <button class="admin-btn" data-role="update-status">Обновить</button>
                </div>
                <div class="admin-issue-detail__response-section">
                    <label class="admin-issue-detail__section-title">Ответить</label>
                    <textarea class="admin-issue-detail__textarea" placeholder="Введите ответ..."></textarea>
                    <button class="admin-btn" data-role="send-response">Отправить ответ</button>
                </div>
            </div>`;
    }

    /**
     * Подключает обработчики кнопок в детальном виде (обновление статуса +
     * отправка ответа).
     * @param container - корневой элемент detail-view
     * @param issueId - ID текущего обращения
     */
    #wireDetailActions(container: HTMLElement, issueId: number): void {
        const statusSelect = nn(
            container.querySelector<HTMLSelectElement>('[data-role="status-select"]')
        );
        const updateBtn = nn(
            container.querySelector<HTMLButtonElement>('[data-role="update-status"]')
        );
        updateBtn.addEventListener('click', () => {
            void this.#doUpdateStatus(issueId, statusSelect.value);
        });

        const responseTextarea = nn(
            container.querySelector<HTMLTextAreaElement>('.admin-issue-detail__textarea')
        );
        const sendBtn = nn(
            container.querySelector<HTMLButtonElement>('[data-role="send-response"]')
        );
        sendBtn.addEventListener('click', () => {
            void this.#doSendResponse(issueId, responseTextarea.value.trim());
        });
    }

    /**
     * Меняет статус обращения через API и перезагружает detail-view.
     * @param issueId - ID обращения
     * @param status - новый статус
     */
    async #doUpdateStatus(issueId: number, status: string): Promise<void> {
        try {
            await this.#api.updateIssueStatus(issueId, status);
            void this.#showDetail(issueId);
        } catch (e: unknown) {
            logError('Failed to update issue status:', e);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Отправляет ответ на обращение через API и перезагружает detail-view.
     * Пустой текст не отправляется.
     * @param issueId - ID обращения
     * @param text - текст ответа (уже trim'нутый)
     */
    async #doSendResponse(issueId: number, text: string): Promise<void> {
        if (text === '') return;
        try {
            await this.#api.respondToIssue(issueId, text);
            void this.#showDetail(issueId);
        } catch (e: unknown) {
            logError('Failed to send response:', e);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Строит HTML-блок с вложениями обращения. Возвращает пустую строку
     * если вложений нет.
     * @param issueId - ID обращения (для построения download URL'ов)
     * @param attachments - массив вложений (или undefined)
     * @returns HTML-строка блока attachments
     */
    #buildAttachmentsHtml(
        issueId: number,
        attachments: Record<string, unknown>[] | undefined
    ): string {
        if (!attachments || attachments.length === 0) return '';
        const items = attachments
            .map(
                (att) =>
                    `<a class="admin-issue-detail__attachment" href="/api/v1/issues/${String(issueId)}/attachments/${String(att.id)}" target="_blank">${escapeHtml(att.filename ?? att.name ?? 'Файл')}</a>`
            )
            .join('');
        return `
            <div class="admin-issue-detail__section">
                <h4 class="admin-issue-detail__section-title">Вложения</h4>
                <div class="admin-issue-detail__attachments">${items}</div>
            </div>`;
    }

    /**
     * Строит HTML-блок с цепочкой сообщений (диалог user ↔ admin).
     * Возвращает пустую строку если сообщений нет.
     * @param messages - массив сообщений (или undefined)
     * @returns HTML-строка блока messages
     */
    #buildMessagesHtml(messages: Record<string, unknown>[] | undefined): string {
        if (!messages || messages.length === 0) return '';
        const items = messages
            .map((m) => {
                const mDate = this.#formatDateTime(m.created_at as string);
                const isAdmin = m.is_admin !== undefined && m.is_admin !== null;
                const author = isAdmin
                    ? 'Администратор'
                    : (m.username as string) || `User #${String(m.user_id)}`;
                const cls = isAdmin
                    ? 'admin-issue-detail__message--admin'
                    : 'admin-issue-detail__message--user';
                return `<div class="admin-issue-detail__message ${cls}">
                    <div class="admin-issue-detail__message-meta">
                        <span class="admin-issue-detail__message-author">${escapeHtml(author)}</span>
                        <span class="admin-issue-detail__message-date">${mDate}</span>
                    </div>
                    <div class="admin-issue-detail__message-text">${escapeHtml(m.content)}</div>
                </div>`;
            })
            .join('');
        return `
            <div class="admin-issue-detail__section">
                <h4 class="admin-issue-detail__section-title">Сообщения</h4>
                <div class="admin-issue-detail__messages">${items}</div>
            </div>`;
    }

    /**
     * Форматирует ISO-дату в "DD.MM.YYYY HH:MM" в локали ru-RU.
     * @param iso - ISO-строка даты
     * @returns отформатированная дата с временем
     */
    #formatDateTime(iso: string): string {
        return new Date(iso).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Универсальный рендерер бейджа из словаря (статусы / категории).
     * Неизвестный ключ показывается как есть, без CSS-класса.
     * @param badges - словарь {ключ: BadgeDescriptor}
     * @param key - ключ для поиска в словаре
     * @returns HTML-строка span'а с классом и текстом бейджа
     */
    #issueBadge(badges: Record<string, BadgeDescriptor>, key: string): string {
        const b = badges[key] ?? { cls: '', label: key };
        return `<span class="admin-badge ${b.cls}">${b.label}</span>`;
    }
}
