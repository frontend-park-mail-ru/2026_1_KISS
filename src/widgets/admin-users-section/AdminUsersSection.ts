import { AdminApi } from '../../shared/api/AdminApi.js';
import { ContextMenu } from '../../shared/components/context-menu/ContextMenu.js';
import { Modal } from '../../shared/components/modal/Modal.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { logError } from '../../shared/utils/logger.js';
import {
    PLAN_OPTIONS,
    formatDuration,
    formatRelativeTime,
    plural,
    planBadge,
    renderPagination
} from '../admin-shared/admin-helpers.js';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Виджет секции "Пользователи" в админке. Рендерит таблицу пользователей
 * с поиском, пагинацией и контекстным меню (изменение имени/email/пароля/
 * тарифа, отправка письма, бан). Каждое действие открывает Modal с формой;
 * после успешного апдейта таблица перезагружается.
 *
 * Заменяет ~310 строк методов в AdminPage (#initUsersSection +
 * #refreshUsersTable + #showUserContextMenu + 6 диалогов).
 */
export class AdminUsersSection {
    #parent: HTMLElement;
    #api: AdminApi;
    #contextMenu: ContextMenu;
    #modal: Modal;
    #currentUserId: number;
    #currentPage = 1;
    #currentSearch = '';
    #searchTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Сохраняет родительский элемент и инициализирует AdminApi/ContextMenu/Modal.
     * @param parent - элемент, в который будет вставлен контент секции
     * @param currentUserId - ID текущего админа (для предотвращения бана самого себя)
     */
    public constructor(parent: HTMLElement, currentUserId: number) {
        this.#parent = parent;
        this.#api = new AdminApi();
        this.#contextMenu = new ContextMenu();
        this.#modal = new Modal();
        this.#currentUserId = currentUserId;
    }

    /**
     * Рендерит структуру секции и запускает первую загрузку.
     */
    public mount(): void {
        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Пользователи';
        this.#parent.appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по имени или email...';
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
        countEl.dataset.role = 'user-count';
        header.appendChild(countEl);
        this.#parent.appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        this.#parent.appendChild(tableContainer);

        void this.#refreshTable();
    }

    /**
     * Очищает родительский элемент и таймер поиска.
     */
    public unmount(): void {
        if (this.#searchTimeout !== null) clearTimeout(this.#searchTimeout);
        this.#parent.innerHTML = '';
    }

    /**
     * Перезагружает таблицу пользователей.
     */
    async #refreshTable(): Promise<void> {
        const tableContainer = this.#parent.querySelector('.admin-table-container');
        const countEl = this.#parent.querySelector('[data-role="user-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const offset = (this.#currentPage - 1) * PAGE_SIZE;

        try {
            const data = await this.#api.getUsers(PAGE_SIZE, offset, this.#currentSearch);
            const users = data.users as unknown as Record<string, unknown>[];
            const total = data.total;
            if (countEl) {
                countEl.textContent = `${String(total)} пользовател${plural(total, 'ь', 'я', 'ей')}`;
            }

            if (users.length === 0) {
                tableContainer.innerHTML = '<div class="admin-empty">Пользователи не найдены</div>';
                return;
            }

            tableContainer.appendChild(this.#buildTable(users));

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
     * Строит таблицу пользователей с context-menu на правый клик.
     * @param users - массив пользователей от API
     * @returns готовая таблица для вставки в DOM
     */
    #buildTable(users: Record<string, unknown>[]): HTMLTableElement {
        const table = document.createElement('table');
        table.className = 'admin-table';
        table.innerHTML = `<colgroup>
            <col style="width:50px"><col style="width:18%"><col style="width:22%">
            <col style="width:80px"><col style="width:100px"><col style="width:100px">
            <col style="width:110px"><col style="width:100px">
        </colgroup>
        <thead><tr>
            <th>ID</th><th>Имя</th><th>Email</th><th>Группа</th>
            <th>Активность</th><th>Общее время</th><th>Регистрация</th><th>Статус</th>
        </tr></thead>`;

        const tbody = document.createElement('tbody');
        users.forEach((user) => {
            tbody.appendChild(this.#buildRow(user));
        });
        table.appendChild(tbody);
        return table;
    }

    /**
     * Строит одну строку таблицы пользователей.
     * @param user - данные пользователя
     * @returns готовая строка `<tr>`
     */
    #buildRow(user: Record<string, unknown>): HTMLTableRowElement {
        const tr = document.createElement('tr');
        const badge = planBadge(user.plan as string);
        const isBanned = user.status === 'banned';
        let statusBadge = '';
        if (isBanned) {
            statusBadge = '<span class="admin-badge admin-badge--banned">banned</span>';
        } else if (user.is_verified !== true) {
            statusBadge = '<span class="admin-badge admin-badge--freeze">не подтверждён</span>';
        }

        tr.innerHTML = `
            <td class="admin-table__muted">${String(user.id)}</td>
            <td class="admin-table__cell-truncate" title="${escapeHtml(user.username)}"><strong>${escapeHtml(user.username)}</strong></td>
            <td class="admin-table__cell-truncate" title="${escapeHtml(user.email)}">${escapeHtml(user.email)}</td>
            <td>${badge}</td>
            <td class="admin-table__muted">${formatRelativeTime(user.last_active_at as string)}</td>
            <td class="admin-table__muted">${formatDuration((user.total_time_seconds as number) || 0)}</td>
            <td class="admin-table__muted">${new Date(user.created_at as string).toLocaleDateString('ru-RU')}</td>
            <td>${statusBadge}</td>`;

        tr.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.#showContextMenu(e, user);
        });
        return tr;
    }

    /**
     * Открывает контекстное меню для строки пользователя. Базовые действия
     * доступны всегда; "Забанить" — только если: не сам админ, plan=freeze,
     * не уже забанен.
     * @param e - событие contextmenu (для координат)
     * @param user - объект пользователя
     */
    #showContextMenu(e: MouseEvent, user: Record<string, unknown>): void {
        const actions: { label: string; danger?: boolean; handler: () => void }[] = [
            { label: 'Изменить имя', handler: () => void this.#editUsername(user) },
            { label: 'Изменить email', handler: () => void this.#editEmail(user) },
            { label: 'Сменить пароль', handler: () => void this.#changePassword(user) },
            { label: 'Изменить тариф', handler: () => void this.#changePlan(user) },
            { label: 'Отправить email', handler: () => void this.#sendEmail(user) }
        ];
        if (user.id !== this.#currentUserId && user.plan === 'freeze' && user.status !== 'banned') {
            actions.push({
                label: 'Забанить',
                danger: true,
                handler: () => void this.#ban(user)
            });
        }
        this.#contextMenu.show(e.clientX, e.clientY, actions);
    }

    /**
     * Открывает Modal с одним полем username.
     * @param user - редактируемый пользователь
     */
    async #editUsername(user: Record<string, unknown>): Promise<void> {
        const result = await this.#modal.open('Изменить имя', [
            {
                name: 'username',
                label: 'Имя пользователя',
                type: 'text',
                value: user.username as string
            }
        ]);
        if (!result || result.username === user.username) return;
        await this.#applyUserUpdate(user, { username: result.username, email: user.email });
    }

    /**
     * Открывает Modal с одним полем email.
     * @param user - редактируемый пользователь
     */
    async #editEmail(user: Record<string, unknown>): Promise<void> {
        const result = await this.#modal.open('Изменить email', [
            { name: 'email', label: 'Email', type: 'text', value: user.email as string }
        ]);
        if (!result || result.email === user.email) return;
        await this.#applyUserUpdate(user, { username: user.username, email: result.email });
    }

    /**
     * Открывает Modal для ввода нового пароля и вызывает админский reset.
     * @param user - пользователь, которому меняем пароль
     */
    async #changePassword(user: Record<string, unknown>): Promise<void> {
        const result = await this.#modal.open('Сменить пароль', [
            { name: 'password', label: 'Новый пароль (минимум 8 символов)', type: 'password' }
        ]);
        if (result?.password === undefined || result.password === '') return;
        try {
            await this.#api.resetPassword(user.id as string | number, result.password);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert('Пароль изменён');
        } catch (e: unknown) {
            logError('Failed to reset password:', e);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Открывает Modal с select из PLAN_OPTIONS.
     * @param user - пользователь, которому меняем тариф
     */
    async #changePlan(user: Record<string, unknown>): Promise<void> {
        const result = await this.#modal.open('Изменить тариф', [
            {
                name: 'plan',
                label: 'Тариф',
                type: 'select',
                value: user.plan as string,
                options: PLAN_OPTIONS
            }
        ]);
        if (!result || result.plan === user.plan) return;
        try {
            await this.#api.setPlan(user.id as string | number, result.plan);
            void this.#refreshTable();
        } catch (e: unknown) {
            logError('Failed to set plan:', e);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Открывает Modal с двумя полями (subject + textarea body) и отправляет
     * письмо.
     * @param user - получатель
     */
    async #sendEmail(user: Record<string, unknown>): Promise<void> {
        const result = await this.#modal.open('Отправить email', [
            { name: 'subject', label: 'Тема', type: 'text' },
            { name: 'body', label: 'Сообщение', type: 'textarea' }
        ]);
        if (result === null || result.subject === '' || result.body === '') return;
        try {
            await this.#api.sendEmail(user.email as string, result.subject, result.body);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert('Письмо отправлено');
        } catch (e: unknown) {
            logError('Failed to send email:', e);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Банит пользователя после confirm-диалога.
     * @param user - блокируемый пользователь
     */
    async #ban(user: Record<string, unknown>): Promise<void> {
        const message = `Забанить "${String(user.username)}"? Публичные блокноты станут приватными.`;
        // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
        if (!confirm(message)) {
            return;
        }
        try {
            await this.#api.banUser(user.id as string | number);
            void this.#refreshTable();
        } catch (e: unknown) {
            logError('Failed to ban user:', e);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Применяет обновление пользователя (username/email) и перезагружает
     * таблицу. Используется из #editUsername и #editEmail.
     * @param user - оригинальный пользователь (для id)
     * @param payload - тело PUT-запроса (username и email вместе)
     */
    async #applyUserUpdate(
        user: Record<string, unknown>,
        payload: { username: unknown; email: unknown }
    ): Promise<void> {
        try {
            await this.#api.updateUser(user.id as string | number, {
                username: payload.username,
                email: payload.email
            });
            void this.#refreshTable();
        } catch (e: unknown) {
            logError('Failed to update user:', e);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }
}
