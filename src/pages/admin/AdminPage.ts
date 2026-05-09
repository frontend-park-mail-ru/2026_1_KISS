import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { AdminApi } from '../../shared/api/AdminApi.js';
import { Router } from '../../shared/router/Router.js';
import { ContextMenu } from '../../shared/components/context-menu/ContextMenu.js';
import { Modal } from '../../shared/components/modal/Modal.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import { nn } from '../../shared/utils/notNull.js';

function AdminPageTemplate(): string {
    return `<main class="admin-page">
    <div class="admin-page__container">
        <nav class="admin-page__sidebar">
            <div class="admin-page__sidebar-group">
                <h3 class="admin-page__sidebar-title">Управление</h3>
                <button class="admin-page__sidebar-item admin-page__sidebar-item--active" data-section="stats">Статистика</button>
                <button class="admin-page__sidebar-item" data-section="users">Пользователи</button>
                <button class="admin-page__sidebar-item" data-section="notebooks">Блокноты</button>
                <button class="admin-page__sidebar-item" data-section="issues">Обращения</button>
            </div>
        </nav>
        <div class="admin-page__content"></div>
    </div>
</main>`;
}

const PLAN_BADGES: Record<string, { cls: string; label: string }> = {
    free: { cls: 'admin-badge--free', label: 'Free' },
    freeze: { cls: 'admin-badge--freeze', label: 'Freeze' },
    pro: { cls: 'admin-badge--pro', label: 'Pro' },
    max: { cls: 'admin-badge--max', label: 'Max' },
    admin: { cls: 'admin-badge--admin', label: 'Admin' }
};

const PLAN_OPTIONS = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'max', label: 'Max' },
    { value: 'admin', label: 'Admin' }
];

const ISSUE_STATUS_BADGES: Record<string, { cls: string; label: string }> = {
    open: { cls: 'admin-badge--active', label: 'Новое' },
    new: { cls: 'admin-badge--active', label: 'Новое' },
    in_progress: { cls: 'admin-badge--pro', label: 'В работе' },
    resolved: { cls: 'admin-badge--free', label: 'Решено' },
    closed: { cls: 'admin-badge--freeze', label: 'Закрыто' }
};

const ISSUE_CATEGORY_BADGES: Record<string, { cls: string; label: string }> = {
    bug: { cls: 'admin-badge--banned', label: 'Ошибка' },
    idea: { cls: 'admin-badge--pro', label: 'Предложение' },
    problem: { cls: 'admin-badge--freeze', label: 'Проблема' },
    feedback: { cls: 'admin-badge--active', label: 'Общее мнение' }
};

const ISSUE_STATUS_OPTIONS = [
    { value: 'open', label: 'Новое' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'resolved', label: 'Решено' },
    { value: 'closed', label: 'Закрыто' }
];

export class AdminPage {
    #root: HTMLElement;
    #httpClient: HttpClient;
    #adminApi: AdminApi;
    #user: Record<string, unknown> | null = null;
    #activeKey = 'stats';
    #contentArea: HTMLElement | null = null;
    #searchTimeout: ReturnType<typeof setTimeout> | null = null;
    #contextMenu: ContextMenu | null = null;
    #modal: Modal | null = null;
    #currentUserPage = 1;
    #currentUserSearch = '';
    #currentNbPage = 1;
    #currentNbSearch = '';
    #currentIssuePage = 1;
    #currentIssueSearch = '';
    #feedbackModal: FeedbackModal | null = null;

    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
        this.#adminApi = new AdminApi();
    }

    public async render(): Promise<void> {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                nn(Router.getInstance()).navigate('/sign');
                return;
            }
            const { data: user } = (await response.json()) as { data: Record<string, unknown> };
            if (!user.is_admin) {
                nn(Router.getInstance()).navigate('/files');
                return;
            }
            this.#user = user;
        } catch (_e) {
            nn(Router.getInstance()).navigate('/sign');
            return;
        }

        const initials = (this.#user.username as string).substring(0, 2).toUpperCase();
        const header = new GreenHeader(this.#root, {
            user: {
                username: this.#user.username as string,
                initials,
                avatarUrl: (this.#user.avatar_url as string) || ''
            },
            onProfile: () => { nn(Router.getInstance()).navigate('/profile'); },
            onAdmin: () => { /* noop */ },
            onFeedback: () => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onLogout: async () => {
                await this.#httpClient.post('/auth/logout').catch(() => { /* noop */ });
                nn(Router.getInstance()).navigate('/sign');
            }
        });
        header.render();

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = AdminPageTemplate();
        const main = nn(tempContainer.firstElementChild);
        this.#root.appendChild(main);

        this.#contentArea = nn(main.querySelector('.admin-page__content'));
        this.#contextMenu = new ContextMenu();
        this.#modal = new Modal();
        this.#attachSidebarEvents(main as HTMLElement);
        this.#showSection('stats');
    }

    #attachSidebarEvents(main: HTMLElement): void {
        const items = main.querySelectorAll('.admin-page__sidebar-item');
        items.forEach((item) => {
            item.addEventListener('click', () => {
                const section = (item as HTMLElement).dataset.section;
                if (section && section !== this.#activeKey) {
                    items.forEach((i) => { i.classList.remove('admin-page__sidebar-item--active'); });
                    item.classList.add('admin-page__sidebar-item--active');
                    this.#showSection(section);
                }
            });
        });
    }

    #showSection(key: string): void {
        this.#activeKey = key;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.#contentArea!.innerHTML = '';
        switch (key) {
            case 'stats':
                void this.#renderStats();
                break;
            case 'users':
                this.#initUsersSection();
                break;
            case 'notebooks':
                this.#initNotebooksSection();
                break;
            case 'issues':
                this.#initIssuesSection();
                break;
        }
    }

    async #renderStats(): Promise<void> {
        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Статистика платформы';
        nn(this.#contentArea).appendChild(title);

        try {
            const stats = (await this.#adminApi.getStats()) as Record<string, unknown>;
            const cards = [
                {
                    label: 'Пользователи',
                    value: stats.total_users ?? 0,
                    tooltip: 'Общее количество зарегистрированных пользователей на платформе'
                },
                {
                    label: 'Блокноты',
                    value: stats.total_notebooks ?? 0,
                    tooltip: 'Общее количество блокнотов на платформе'
                },
                {
                    label: 'DAU',
                    value: stats.dau ?? 0,
                    tooltip: 'Daily Active Users — уникальные пользователи за последние 24 часа'
                },
                {
                    label: 'MAU',
                    value: stats.mau ?? 0,
                    tooltip: 'Monthly Active Users — уникальные пользователи за последние 30 дней'
                }
            ];

            const grid = document.createElement('div');
            grid.className = 'admin-stats-grid';
            cards.forEach(({ label, value, tooltip }) => {
                const card = document.createElement('div');
                card.className = 'admin-stat-card';
                card.innerHTML = `<div class="admin-stat-card__value">${this.#esc(value)}</div><div class="admin-stat-card__label">${this.#esc(label)} <span class="admin-stat-card__hint">?<span class="admin-stat-card__tooltip">${this.#esc(tooltip)}</span></span></div>`;
                grid.appendChild(card);
            });
            nn(this.#contentArea).appendChild(grid);

            const activityData = (await this.#adminApi.getActivityStats(30, 12)) as Record<
                string,
                unknown
            >;
            const dauFilled = this.#fillDays(
                (activityData.dau as { date: string; count: number }[] | undefined) ?? [],
                30
            );
            const mauFilled = this.#fillMonths(
                (activityData.mau as { month: string; count: number }[] | undefined) ?? [],
                12
            );
            this.#renderTimeSeriesChart('DAU (последние 30 дней)', dauFilled, 'date', 'count');
            this.#renderTimeSeriesChart('MAU (последние 12 месяцев)', mauFilled, 'month', 'count');

            const issueStats = (await this.#adminApi.getIssueStats().catch(() => null)) as Record<
                string,
                unknown
            > | null;
            if (issueStats) {
                const issueTitle = document.createElement('h2');
                issueTitle.className = 'admin-page__section-title';
                issueTitle.style.marginTop = '32px';
                issueTitle.textContent = 'Обращения';
                nn(this.#contentArea).appendChild(issueTitle);

                const issueCards = [
                    {
                        label: 'Всего',
                        value: issueStats.total ?? 0,
                        tooltip: 'Общее количество обращений от пользователей'
                    },
                    {
                        label: 'Открыто',
                        value: issueStats.open ?? 0,
                        tooltip: 'Обращения, ожидающие рассмотрения'
                    },
                    {
                        label: 'В работе',
                        value: issueStats.in_progress ?? 0,
                        tooltip: 'Обращения, находящиеся в работе'
                    },
                    {
                        label: 'Закрыто',
                        value: issueStats.closed ?? 0,
                        tooltip: 'Решённые обращения'
                    }
                ];

                const issueGrid = document.createElement('div');
                issueGrid.className = 'admin-stats-grid';
                issueCards.forEach(({ label, value, tooltip }) => {
                    const card = document.createElement('div');
                    card.className = 'admin-stat-card';
                    card.innerHTML = `<div class="admin-stat-card__value">${this.#esc(value)}</div><div class="admin-stat-card__label">${this.#esc(label)} <span class="admin-stat-card__hint">?<span class="admin-stat-card__tooltip">${this.#esc(tooltip)}</span></span></div>`;
                    issueGrid.appendChild(card);
                });
                nn(this.#contentArea).appendChild(issueGrid);

                const cat = (issueStats.by_category as Record<string, number> | undefined) ?? {};
                const categoryData = [
                    { label: 'Ошибки', count: cat.bug || 0 },
                    { label: 'Предложения', count: cat.idea || 0 },
                    { label: 'Проблемы', count: cat.problem || 0 },
                    { label: 'Общее', count: cat.feedback || 0 }
                ];
                this.#renderTimeSeriesChart(
                    'Обращения по категориям',
                    categoryData,
                    'label',
                    'count'
                );
            }
        } catch (e: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.#contentArea!.innerHTML += `<div class="admin-empty">Ошибка загрузки: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    #renderTimeSeriesChart(
        titleText: string,
        data: Record<string, unknown>[],
        keyField: string,
        valueField: string
    ): void {
        const chart = document.createElement('div');
        chart.className = 'admin-chart';
        chart.innerHTML = `<div class="admin-chart__title">${this.#esc(titleText)}</div>`;

        const maxVal = Math.max(...data.map((e) => e[valueField] as number), 1);
        const width = 700;
        const height = 220;
        const padding = { left: 44, right: 10, top: 20, bottom: 54 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const gap = 3;
        const barW = Math.max(4, Math.floor(chartW / data.length) - gap);
        const offsetX = padding.left;

        const ticks = this.#calcYTicks(maxVal);

        let svg = `<svg viewBox="0 0 ${width} ${height}" class="admin-chart__svg">`;
        svg += `<line x1="${padding.left}" y1="${padding.top + chartH}" x2="${padding.left + chartW}" y2="${padding.top + chartH}" stroke="var(--cell-border)" stroke-width="1"/>`;

        ticks.forEach(({ value, label }) => {
            const y = padding.top + chartH - (value / maxVal) * chartH;
            svg += `<text x="${padding.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--accent)">${label}</text>`;
            if (value > 0)
                svg += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartW}" y2="${y}" stroke="var(--light-grey)" stroke-width="1" stroke-dasharray="4,3"/>`;
        });

        const labelStep = Math.max(1, Math.ceil(data.length / 15));

        data.forEach((entry, i) => {
            const x = offsetX + i * (barW + gap);
            const val = entry[valueField] as number;
            const barH = val > 0 ? Math.max(2, (val / maxVal) * chartH) : 0;
            const y = padding.top + chartH - barH;

            const opacity = val > 0 ? 1 : 0.15;
            svg += `<rect x="${x}" y="${val > 0 ? y : padding.top + chartH - 2}" width="${barW}" height="${val > 0 ? barH : 2}" fill="var(--teal-green)" opacity="${opacity}" rx="1"><title>${this.#formatChartLabel(entry[keyField] as string, keyField)}: ${val}</title></rect>`;

            if (i % labelStep === 0) {
                const lbl = this.#formatChartLabel(entry[keyField] as string, keyField);
                const tx = x + barW / 2;
                const ty = padding.top + chartH + 10;
                svg += `<text x="${tx}" y="${ty}" text-anchor="end" font-size="9" fill="var(--accent)" transform="rotate(-45 ${tx} ${ty})">${lbl}</text>`;
            }
        });

        svg += '</svg>';
        chart.innerHTML += svg;
        nn(this.#contentArea).appendChild(chart);
    }

    #formatChartLabel(raw: string, keyField: string): string {
        const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
        if (keyField === 'date') {
            const parts = raw.split('-');
            if (parts.length === 3) {
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                return `${parts[2]}.${parts[1]}.${parts[0].slice(2)}(${DAYS[d.getDay()]})`;
            }
        }
        if (keyField === 'month') {
            const parts = raw.split('-');
            if (parts.length === 2) return `${parts[1]}.${parts[0].slice(2)}`;
        }
        return raw;
    }

    #calcYTicks(maxVal: number): { value: number; label: string }[] {
        if (maxVal <= 0) return [{ value: 0, label: '0' }];
        if (maxVal <= 5) {
            const ticks: { value: number; label: string }[] = [];
            for (let i = 0; i <= maxVal; i++) ticks.push({ value: i, label: String(i) });
            return ticks;
        }
        const step = Math.ceil(maxVal / 4);
        const ticks: { value: number; label: string }[] = [];
        for (let i = 0; i <= 4; i++) {
            const v = step * i;
            ticks.push({ value: Math.min(v, maxVal), label: String(Math.min(v, maxVal)) });
        }
        return ticks;
    }

    #fillDays(
        entries: { date: string; count: number }[],
        count: number
    ): { date: string; count: number }[] {
        const map = new Map<string, number>();
        entries.forEach((e) => map.set(e.date, e.count));
        const result: { date: string; count: number }[] = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            result.push({ date: key, count: map.get(key) ?? 0 });
        }
        return result;
    }

    #fillMonths(
        entries: { month: string; count: number }[],
        count: number
    ): { month: string; count: number }[] {
        const map = new Map<string, number>();
        entries.forEach((e) => map.set(e.month, e.count));
        const result: { month: string; count: number }[] = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            result.push({ month: key, count: map.get(key) ?? 0 });
        }
        return result;
    }

    #initUsersSection(): void {
        this.#currentUserPage = 1;
        this.#currentUserSearch = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Пользователи';
        nn(this.#contentArea).appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по имени или email...';
        searchInput.addEventListener('input', () => {
            clearTimeout(nn(this.#searchTimeout));
            this.#searchTimeout = setTimeout(() => {
                this.#currentUserSearch = searchInput.value;
                this.#currentUserPage = 1;
                void this.#refreshUsersTable();
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'user-count';
        header.appendChild(countEl);
        nn(this.#contentArea).appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        nn(this.#contentArea).appendChild(tableContainer);

        void this.#refreshUsersTable();
    }

    async #refreshUsersTable(): Promise<void> {
        const tableContainer = nn(this.#contentArea).querySelector('.admin-table-container');
        const countEl = nn(this.#contentArea).querySelector('[data-role="user-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const limit = 15;
        const offset = (this.#currentUserPage - 1) * limit;

        try {
            const data = (await this.#adminApi.getUsers(
                limit,
                offset,
                this.#currentUserSearch
            )) as Record<string, unknown>;
            const users: Record<string, unknown>[] =
                (data.users as Record<string, unknown>[] | undefined) ?? [];
            const total: number = (data.total as number) || 0;
            if (countEl)
                countEl.textContent = `${total} пользовател${this.#plural(total, 'ь', 'я', 'ей')}`;

            if (users.length === 0) {
                tableContainer.innerHTML = '<div class="admin-empty">Пользователи не найдены</div>';
                return;
            }

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
                const tr = document.createElement('tr');
                const badge = this.#planBadge(user.plan as string);
                const isBanned = user.status === 'banned';
                let statusBadge = '';
                if (isBanned) {
                    statusBadge = '<span class="admin-badge admin-badge--banned">banned</span>';
                } else if (!user.is_verified) {
                    statusBadge =
                        '<span class="admin-badge admin-badge--freeze">не подтверждён</span>';
                }

                tr.innerHTML = `
                    <td class="admin-table__muted">${user.id}</td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(user.username as string)}"><strong>${this.#esc(user.username as string)}</strong></td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(user.email as string)}">${this.#esc(user.email as string)}</td>
                    <td>${badge}</td>
                    <td class="admin-table__muted">${this.#formatRelativeTime(user.last_active_at as string)}</td>
                    <td class="admin-table__muted">${this.#formatDuration((user.total_time_seconds as number) || 0)}</td>
                    <td class="admin-table__muted">${new Date(user.created_at as string).toLocaleDateString('ru-RU')}</td>
                    <td>${statusBadge}</td>`;

                tr.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.#showUserContextMenu(e, user);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);

            const totalPages = Math.ceil(total / limit);
            if (totalPages > 1) {
                this.#renderPagination(
                    tableContainer as HTMLElement,
                    this.#currentUserPage,
                    totalPages,
                    (p: number) => {
                        this.#currentUserPage = p;
                        void this.#refreshUsersTable();
                    }
                );
            }
        } catch (e: unknown) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    #showUserContextMenu(e: MouseEvent, user: Record<string, unknown>): void {
        const actions: { label: string; danger?: boolean; handler: () => void }[] = [];
        actions.push({
            label: 'Изменить имя',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#editUsername(user)
        });
        actions.push({
            label: 'Изменить email',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#editEmail(user)
        });
        actions.push({
            label: 'Сменить пароль',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#changePassword(user)
        });
        actions.push({
            label: 'Изменить тариф',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#changePlan(user)
        });
        actions.push({
            label: 'Отправить email',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#sendEmailToUser(user)
        });
        if (user.id !== nn(this.#user).id && user.plan === 'freeze' && user.status !== 'banned') {
            actions.push({
                label: 'Забанить',
                danger: true,
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                handler: () => this.#banUser(user)
            });
        }
        nn(this.#contextMenu).show(e.clientX, e.clientY, actions);
    }

    async #editUsername(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Изменить имя', [
            {
                name: 'username',
                label: 'Имя пользователя',
                type: 'text',
                value: user.username as string
            }
        ]);
        if (!result || result.username === user.username) return;
        try {
            await this.#adminApi.updateUser(user.id as string | number, {
                username: result.username,
                email: user.email
            });
            void this.#refreshUsersTable();
        } catch (e: unknown) {
            alert((e as Error).message);
        }
    }

    async #editEmail(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Изменить email', [
            { name: 'email', label: 'Email', type: 'text', value: user.email as string }
        ]);
        if (!result || result.email === user.email) return;
        try {
            await this.#adminApi.updateUser(user.id as string | number, {
                username: user.username,
                email: result.email
            });
            void this.#refreshUsersTable();
        } catch (e: unknown) {
            alert((e as Error).message);
        }
    }

    async #changePassword(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Сменить пароль', [
            { name: 'password', label: 'Новый пароль (минимум 8 символов)', type: 'password' }
        ]);
        if (!result?.password) return;
        try {
            await this.#adminApi.resetPassword(user.id as string | number, result.password);
            alert('Пароль изменён');
        } catch (e: unknown) {
            alert((e as Error).message);
        }
    }

    async #changePlan(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Изменить тариф', [
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
            await this.#adminApi.setPlan(user.id as string | number, result.plan);
            void this.#refreshUsersTable();
        } catch (e: unknown) {
            alert((e as Error).message);
        }
    }

    async #sendEmailToUser(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Отправить email', [
            { name: 'subject', label: 'Тема', type: 'text' },
            { name: 'body', label: 'Сообщение', type: 'textarea' }
        ]);
        if (!result?.subject || !result.body) return;
        try {
            await this.#adminApi.sendEmail(user.email as string, result.subject, result.body);
            alert('Письмо отправлено');
        } catch (e: unknown) {
            alert((e as Error).message);
        }
    }

    async #banUser(user: Record<string, unknown>): Promise<void> {
        if (!confirm(`Забанить "${user.username}"? Публичные блокноты станут приватными.`)) return;
        try {
            await this.#adminApi.banUser(user.id as string | number);
            void this.#refreshUsersTable();
        } catch (e: unknown) {
            alert((e as Error).message);
        }
    }

    #initNotebooksSection(): void {
        this.#currentNbPage = 1;
        this.#currentNbSearch = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Блокноты';
        nn(this.#contentArea).appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по названию...';
        searchInput.addEventListener('input', () => {
            clearTimeout(nn(this.#searchTimeout));
            this.#searchTimeout = setTimeout(() => {
                this.#currentNbSearch = searchInput.value;
                this.#currentNbPage = 1;
                void this.#refreshNotebooksTable();
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'nb-count';
        header.appendChild(countEl);
        nn(this.#contentArea).appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        nn(this.#contentArea).appendChild(tableContainer);

        void this.#refreshNotebooksTable();
    }

    async #refreshNotebooksTable(): Promise<void> {
        const tableContainer = nn(this.#contentArea).querySelector('.admin-table-container');
        const countEl = nn(this.#contentArea).querySelector('[data-role="nb-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const limit = 15;
        const offset = (this.#currentNbPage - 1) * limit;

        try {
            const data = (await this.#adminApi.getNotebooks(
                limit,
                offset,
                this.#currentNbSearch
            )) as Record<string, unknown>;
            const notebooks: Record<string, unknown>[] =
                (data.notebooks as Record<string, unknown>[] | undefined) ?? [];
            const total: number = (data.total as number) || 0;
            if (countEl)
                countEl.textContent = `${total} блокнот${this.#plural(total, '', 'а', 'ов')}`;

            if (notebooks.length === 0) {
                tableContainer.innerHTML = '<div class="admin-empty">Блокноты не найдены</div>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<colgroup>
                <col style="width:50px"><col style="width:40%"><col style="width:80px">
                <col style="width:80px"><col style="width:120px">
            </colgroup>
            <thead><tr>
                <th>ID</th><th>Название</th><th>Owner ID</th><th>Доступ</th><th>Создан</th>
            </tr></thead>`;

            const tbody = document.createElement('tbody');
            notebooks.forEach((nb) => {
                const tr = document.createElement('tr');
                const accessBadge = nb.is_public
                    ? '<span class="admin-badge admin-badge--active">public</span>'
                    : '<span class="admin-badge">private</span>';

                tr.innerHTML = `
                    <td class="admin-table__muted">${nb.id}</td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(nb.title as string)}"><strong>${this.#esc(nb.title as string)}</strong></td>
                    <td class="admin-table__muted">${nb.owner_id}</td>
                    <td>${accessBadge}</td>
                    <td class="admin-table__muted">${new Date(nb.created_at as string).toLocaleDateString('ru-RU')}</td>`;

                tr.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    nn(this.#contextMenu).show(e.clientX, e.clientY, [
                        {
                            label: 'Удалить',
                            danger: true,
                            // eslint-disable-next-line @typescript-eslint/no-misused-promises
                            handler: async () => {
                                if (confirm(`Удалить блокнот "${nb.title}"?`)) {
                                    try {
                                        await this.#adminApi.deleteNotebook(
                                            nb.id as string | number
                                        );
                                        void this.#refreshNotebooksTable();
                                    } catch (err: unknown) {
                                        alert((err as Error).message);
                                    }
                                }
                            }
                        }
                    ]);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);

            const totalPages = Math.ceil(total / limit);
            if (totalPages > 1) {
                this.#renderPagination(
                    tableContainer as HTMLElement,
                    this.#currentNbPage,
                    totalPages,
                    (p: number) => {
                        this.#currentNbPage = p;
                        void this.#refreshNotebooksTable();
                    }
                );
            }
        } catch (e: unknown) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    #renderPagination(
        container: HTMLElement,
        current: number,
        total: number,
        onPage: (p: number) => void
    ): void {
        const nav = document.createElement('div');
        nav.className = 'admin-pagination';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'admin-pagination__btn';
        prevBtn.textContent = '<';
        prevBtn.disabled = current <= 1;
        prevBtn.addEventListener('click', () => { onPage(current - 1); });
        nav.appendChild(prevBtn);

        const start = Math.max(1, current - 2);
        const end = Math.min(total, current + 2);

        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.className = 'admin-pagination__btn';
            if (i === current) btn.classList.add('admin-pagination__btn--active');
            btn.textContent = String(i);
            btn.addEventListener('click', () => { onPage(i); });
            nav.appendChild(btn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'admin-pagination__btn';
        nextBtn.textContent = '>';
        nextBtn.disabled = current >= total;
        nextBtn.addEventListener('click', () => { onPage(current + 1); });
        nav.appendChild(nextBtn);

        container.appendChild(nav);
    }

    #planBadge(plan: string): string {
        const b = (PLAN_BADGES[plan] as typeof PLAN_BADGES.free | undefined) ?? PLAN_BADGES.free;
        return `<span class="admin-badge ${b.cls}">${b.label}</span>`;
    }

    #formatRelativeTime(dateStr: string): string {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const diffMs = Date.now() - date.getTime();
        if (diffMs < 0) return 'Только что';
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'Только что';
        if (diffMin < 60) return `${diffMin} мин. назад`;
        const diffHrs = Math.floor(diffMin / 60);
        if (diffHrs < 24) return `${diffHrs} ч. назад`;
        const diffDays = Math.floor(diffHrs / 24);
        if (diffDays < 30) return `${diffDays} дн. назад`;
        return date.toLocaleDateString('ru-RU');
    }

    #formatDuration(seconds: number): string {
        if (!seconds || seconds <= 0) return '0 мин.';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs} ч. ${mins} мин.`;
        return `${mins} мин.`;
    }

    #esc(str: string): string {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    #plural(n: number, one: string, few: string, many: string): string {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 19) return many;
        if (mod10 === 1) return one;
        if (mod10 >= 2 && mod10 <= 4) return few;
        return many;
    }

    #initIssuesSection(): void {
        this.#currentIssuePage = 1;
        this.#currentIssueSearch = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Обращения';
        nn(this.#contentArea).appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по содержанию...';
        searchInput.addEventListener('input', () => {
            clearTimeout(nn(this.#searchTimeout));
            this.#searchTimeout = setTimeout(() => {
                this.#currentIssueSearch = searchInput.value;
                this.#currentIssuePage = 1;
                void this.#refreshIssuesTable();
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'issue-count';
        header.appendChild(countEl);
        nn(this.#contentArea).appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        nn(this.#contentArea).appendChild(tableContainer);

        void this.#refreshIssuesTable();
    }

    async #refreshIssuesTable(): Promise<void> {
        const tableContainer = nn(this.#contentArea).querySelector('.admin-table-container');
        const countEl = nn(this.#contentArea).querySelector('[data-role="issue-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const limit = 15;
        const offset = (this.#currentIssuePage - 1) * limit;

        try {
            const data = (await this.#adminApi.getIssues(
                limit,
                offset,
                this.#currentIssueSearch
            )) as Record<string, unknown>;
            const issues: Record<string, unknown>[] =
                (data.issues as Record<string, unknown>[] | undefined) ?? [];
            const total: number = (data.total as number) || 0;
            if (countEl)
                countEl.textContent = `${total} обращени${this.#plural(total, 'е', 'я', 'й')}`;

            if (issues.length === 0) {
                tableContainer.innerHTML = '<div class="admin-empty">Обращения не найдены</div>';
                return;
            }

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
                const preview = content.length > 60 ? `${content.substring(0, 60)  }...` : content;

                tr.innerHTML = `
                    <td class="admin-table__muted">${issue.id}</td>
                    <td>${catBadge}</td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(content)}">${this.#esc(preview)}</td>
                    <td class="admin-table__muted">${issue.user_id}</td>
                    <td>${statusBadge}</td>
                    <td class="admin-table__muted">${new Date(issue.created_at as string).toLocaleDateString('ru-RU')}</td>`;

                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                tr.addEventListener('click', () => this.#showIssueDetail(issue.id as number));
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);

            const totalPages = Math.ceil(total / limit);
            if (totalPages > 1) {
                this.#renderPagination(
                    tableContainer as HTMLElement,
                    this.#currentIssuePage,
                    totalPages,
                    (p: number) => {
                        this.#currentIssuePage = p;
                        void this.#refreshIssuesTable();
                    }
                );
            }
        } catch (e: unknown) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    async #showIssueDetail(issueId: number): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.#contentArea!.innerHTML = '';

        const backBtn = document.createElement('button');
        backBtn.className = 'admin-issue-detail__back-btn';
        backBtn.innerHTML = '&larr; Назад к обращениям';
        backBtn.addEventListener('click', () => { this.#showSection('issues'); });
        nn(this.#contentArea).appendChild(backBtn);

        const container = document.createElement('div');
        container.className = 'admin-issue-detail';
        container.innerHTML = '<div class="admin-empty">Загрузка...</div>';
        nn(this.#contentArea).appendChild(container);

        try {
            const issue = (await this.#adminApi.getIssue(issueId)) as Record<string, unknown>;
            const catBadge = this.#issueBadge(ISSUE_CATEGORY_BADGES, issue.category as string);
            const statusBadge = this.#issueBadge(ISSUE_STATUS_BADGES, issue.status as string);
            const date = new Date(issue.created_at as string).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const attachments = issue.attachments as Record<string, unknown>[] | undefined;
            let attachmentsHtml = '';
            if (attachments && attachments.length > 0) {
                attachmentsHtml = `
                    <div class="admin-issue-detail__section">
                        <h4 class="admin-issue-detail__section-title">Вложения</h4>
                        <div class="admin-issue-detail__attachments">
                            ${attachments
                                .map(
                                    (att) =>
                                        `<a class="admin-issue-detail__attachment" href="/api/v1/issues/${issueId}/attachments/${att.id}" target="_blank">${this.#esc((att.filename ?? att.name ?? 'Файл') as string)}</a>`
                                )
                                .join('')}
                        </div>
                    </div>`;
            }

            const messages = issue.messages as Record<string, unknown>[] | undefined;
            let messagesHtml = '';
            if (messages && messages.length > 0) {
                const msgs = messages
                    .map((m) => {
                        const mDate = new Date(m.created_at as string).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        const author = m.is_admin
                            ? 'Администратор'
                            : (m.username as string) || `User #${m.user_id}`;
                        const cls = m.is_admin
                            ? 'admin-issue-detail__message--admin'
                            : 'admin-issue-detail__message--user';
                        return `<div class="admin-issue-detail__message ${cls}">
                            <div class="admin-issue-detail__message-meta">
                                <span class="admin-issue-detail__message-author">${this.#esc(author)}</span>
                                <span class="admin-issue-detail__message-date">${mDate}</span>
                            </div>
                            <div class="admin-issue-detail__message-text">${this.#esc(m.content as string)}</div>
                        </div>`;
                    })
                    .join('');
                messagesHtml = `
                    <div class="admin-issue-detail__section">
                        <h4 class="admin-issue-detail__section-title">Сообщения</h4>
                        <div class="admin-issue-detail__messages">${msgs}</div>
                    </div>`;
            }

            container.innerHTML = `
                <h2 class="admin-page__section-title">Обращение #${issue.id}</h2>
                <div class="admin-issue-detail__meta">
                    ${catBadge} ${statusBadge}
                    <span class="admin-table__muted">${this.#esc((issue.username as string) || `User #${issue.user_id}`)}</span>
                    <span class="admin-table__muted">${date}</span>
                </div>
                <div class="admin-issue-detail__content">${this.#esc(issue.content as string)}</div>
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

            const statusSelect = nn(container.querySelector(
                '[data-role="status-select"]'
            ));
            const updateBtn = nn(container.querySelector(
                '[data-role="update-status"]'
            ));
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            updateBtn.addEventListener('click', async () => {
                try {
                    await this.#adminApi.updateIssueStatus(issueId, statusSelect.value);
                    void this.#showIssueDetail(issueId);
                } catch (e: unknown) {
                    alert((e as Error).message);
                }
            });

            const responseTextarea = nn(container.querySelector(
                '.admin-issue-detail__textarea'
            ));
            const sendBtn = nn(container.querySelector(
                '[data-role="send-response"]'
            ));
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            sendBtn.addEventListener('click', async () => {
                const text = responseTextarea.value.trim();
                if (!text) return;
                try {
                    await this.#adminApi.respondToIssue(issueId, text);
                    void this.#showIssueDetail(issueId);
                } catch (e: unknown) {
                    alert((e as Error).message);
                }
            });
        } catch (e: unknown) {
            container.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    #issueBadge(badges: Record<string, { cls: string; label: string }>, key: string): string {
        const b = (badges[key] as { cls: string; label: string } | undefined) ?? { cls: '', label: key };
        return `<span class="admin-badge ${b.cls}">${b.label}</span>`;
    }

    public destroy(): void {
        this.#root.innerHTML = '';
    }
}
