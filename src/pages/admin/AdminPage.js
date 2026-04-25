import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { AdminApi } from '../../shared/api/AdminApi.js';
import { Router } from '../../shared/router/Router.js';
import { ContextMenu } from '../../shared/components/context-menu/ContextMenu.js';
import { Modal } from '../../shared/components/modal/Modal.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';

function AdminPageTemplate() {
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

const PLAN_BADGES = {
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

const ISSUE_STATUS_BADGES = {
    new: { cls: 'admin-badge--active', label: 'Новое' },
    in_progress: { cls: 'admin-badge--pro', label: 'В работе' },
    resolved: { cls: 'admin-badge--free', label: 'Решено' },
    closed: { cls: 'admin-badge--freeze', label: 'Закрыто' }
};

const ISSUE_CATEGORY_BADGES = {
    bug: { cls: 'admin-badge--banned', label: 'Ошибка' },
    idea: { cls: 'admin-badge--pro', label: 'Предложение' },
    problem: { cls: 'admin-badge--freeze', label: 'Проблема' },
    feedback: { cls: 'admin-badge--active', label: 'Общее мнение' }
};

const ISSUE_STATUS_OPTIONS = [
    { value: 'new', label: 'Новое' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'resolved', label: 'Решено' },
    { value: 'closed', label: 'Закрыто' }
];

export class AdminPage {
    #root;
    #httpClient;
    #adminApi;
    #user = null;
    #activeKey = 'stats';
    #contentArea = null;
    #searchTimeout = null;
    #contextMenu = null;
    #modal = null;
    #currentUserPage = 1;
    #currentUserSearch = '';
    #currentNbPage = 1;
    #currentNbSearch = '';
    #currentIssuePage = 1;
    #currentIssueSearch = '';
    #feedbackModal = null;

    constructor(root) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
        this.#adminApi = new AdminApi();
    }

    async render() {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                Router.getInstance().navigate('/sign');
                return;
            }
            const { data: user } = await response.json();
            if (!user.is_admin) {
                Router.getInstance().navigate('/files');
                return;
            }
            this.#user = user;
        } catch (_e) {
            Router.getInstance().navigate('/sign');
            return;
        }

        const initials = this.#user.username.substring(0, 2).toUpperCase();
        const header = new GreenHeader(this.#root, {
            user: {
                username: this.#user.username,
                initials,
                avatarUrl: this.#user.avatar_url || ''
            },
            onProfile: () => Router.getInstance().navigate('/profile'),
            onAdmin: () => {},
            onFeedback: () => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            onLogout: async () => {
                await this.#httpClient.post('/auth/logout').catch(() => {});
                Router.getInstance().navigate('/sign');
            }
        });
        header.render();

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = AdminPageTemplate();
        const main = tempContainer.firstElementChild;
        this.#root.appendChild(main);

        this.#contentArea = main.querySelector('.admin-page__content');
        this.#contextMenu = new ContextMenu();
        this.#modal = new Modal();
        this.#attachSidebarEvents(main);
        this.#showSection('stats');
    }

    #attachSidebarEvents(main) {
        const items = main.querySelectorAll('.admin-page__sidebar-item');
        items.forEach((item) => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                if (section && section !== this.#activeKey) {
                    items.forEach((i) => i.classList.remove('admin-page__sidebar-item--active'));
                    item.classList.add('admin-page__sidebar-item--active');
                    this.#showSection(section);
                }
            });
        });
    }

    #showSection(key) {
        this.#activeKey = key;
        this.#contentArea.innerHTML = '';
        switch (key) {
            case 'stats':
                this.#renderStats();
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

    async #renderStats() {
        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Статистика платформы';
        this.#contentArea.appendChild(title);

        try {
            const stats = await this.#adminApi.getStats();
            const cards = [
                {
                    label: 'Пользователи',
                    value: stats.total_users || 0,
                    tooltip: 'Общее количество зарегистрированных пользователей на платформе'
                },
                {
                    label: 'Блокноты',
                    value: stats.total_notebooks || 0,
                    tooltip: 'Общее количество блокнотов на платформе'
                },
                {
                    label: 'DAU',
                    value: stats.dau || 0,
                    tooltip: 'Daily Active Users — уникальные пользователи за последние 24 часа'
                },
                {
                    label: 'MAU',
                    value: stats.mau || 0,
                    tooltip: 'Monthly Active Users — уникальные пользователи за последние 30 дней'
                }
            ];

            const grid = document.createElement('div');
            grid.className = 'admin-stats-grid';
            cards.forEach(({ label, value, tooltip }) => {
                const card = document.createElement('div');
                card.className = 'admin-stat-card';
                card.innerHTML = `<div class="admin-stat-card__value">${value}</div><div class="admin-stat-card__label">${this.#esc(label)} <span class="admin-stat-card__hint">?<span class="admin-stat-card__tooltip">${this.#esc(tooltip)}</span></span></div>`;
                grid.appendChild(card);
            });
            this.#contentArea.appendChild(grid);

            const activityData = await this.#adminApi.getActivityStats(30, 12);
            const dauFilled = this.#fillDays(activityData.dau || [], 30);
            const mauFilled = this.#fillMonths(activityData.mau || [], 12);
            this.#renderTimeSeriesChart('DAU (последние 30 дней)', dauFilled, 'date', 'count');
            this.#renderTimeSeriesChart('MAU (последние 12 месяцев)', mauFilled, 'month', 'count');
        } catch (e) {
            this.#contentArea.innerHTML += `<div class="admin-empty">Ошибка загрузки: ${this.#esc(e.message)}</div>`;
        }
    }

    #renderTimeSeriesChart(titleText, data, keyField, valueField) {
        const chart = document.createElement('div');
        chart.className = 'admin-chart';
        chart.innerHTML = `<div class="admin-chart__title">${this.#esc(titleText)}</div>`;

        const maxVal = Math.max(...data.map((e) => e[valueField]), 1);
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
            const val = entry[valueField];
            const barH = val > 0 ? Math.max(2, (val / maxVal) * chartH) : 0;
            const y = padding.top + chartH - barH;

            const opacity = val > 0 ? 1 : 0.15;
            svg += `<rect x="${x}" y="${val > 0 ? y : padding.top + chartH - 2}" width="${barW}" height="${val > 0 ? barH : 2}" fill="var(--teal-green)" opacity="${opacity}" rx="1"><title>${this.#formatChartLabel(entry[keyField], keyField)}: ${val}</title></rect>`;

            if (i % labelStep === 0) {
                const lbl = this.#formatChartLabel(entry[keyField], keyField);
                const tx = x + barW / 2;
                const ty = padding.top + chartH + 10;
                svg += `<text x="${tx}" y="${ty}" text-anchor="end" font-size="9" fill="var(--accent)" transform="rotate(-45 ${tx} ${ty})">${lbl}</text>`;
            }
        });

        svg += '</svg>';
        chart.innerHTML += svg;
        this.#contentArea.appendChild(chart);
    }

    #formatChartLabel(raw, keyField) {
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

    #calcYTicks(maxVal) {
        if (maxVal <= 0) return [{ value: 0, label: '0' }];
        if (maxVal <= 5) {
            const ticks = [];
            for (let i = 0; i <= maxVal; i++) ticks.push({ value: i, label: String(i) });
            return ticks;
        }
        const step = Math.ceil(maxVal / 4);
        const ticks = [];
        for (let i = 0; i <= 4; i++) {
            const v = step * i;
            ticks.push({ value: Math.min(v, maxVal), label: String(Math.min(v, maxVal)) });
        }
        return ticks;
    }

    #fillDays(entries, count) {
        const map = new Map();
        entries.forEach((e) => map.set(e.date, e.count));
        const result = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            result.push({ date: key, count: map.get(key) || 0 });
        }
        return result;
    }

    #fillMonths(entries, count) {
        const map = new Map();
        entries.forEach((e) => map.set(e.month, e.count));
        const result = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            result.push({ month: key, count: map.get(key) || 0 });
        }
        return result;
    }

    #initUsersSection() {
        this.#currentUserPage = 1;
        this.#currentUserSearch = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Пользователи';
        this.#contentArea.appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по имени или email...';
        searchInput.addEventListener('input', () => {
            clearTimeout(this.#searchTimeout);
            this.#searchTimeout = setTimeout(() => {
                this.#currentUserSearch = searchInput.value;
                this.#currentUserPage = 1;
                this.#refreshUsersTable();
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'user-count';
        header.appendChild(countEl);
        this.#contentArea.appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        this.#contentArea.appendChild(tableContainer);

        this.#refreshUsersTable();
    }

    async #refreshUsersTable() {
        const tableContainer = this.#contentArea.querySelector('.admin-table-container');
        const countEl = this.#contentArea.querySelector('[data-role="user-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const limit = 15;
        const offset = (this.#currentUserPage - 1) * limit;

        try {
            const data = await this.#adminApi.getUsers(limit, offset, this.#currentUserSearch);
            const users = data.users || [];
            const total = data.total || 0;
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
                const badge = this.#planBadge(user.plan);
                const isBanned = user.status === 'banned';
                const statusBadge = isBanned
                    ? '<span class="admin-badge admin-badge--banned">banned</span>'
                    : '';

                tr.innerHTML = `
                    <td class="admin-table__muted">${user.id}</td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(user.username)}"><strong>${this.#esc(user.username)}</strong></td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(user.email)}">${this.#esc(user.email)}</td>
                    <td>${badge}</td>
                    <td class="admin-table__muted">${this.#formatRelativeTime(user.last_active_at)}</td>
                    <td class="admin-table__muted">${this.#formatDuration(user.total_time_seconds || 0)}</td>
                    <td class="admin-table__muted">${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                    <td>${statusBadge}</td>`;

                tr.addEventListener('contextmenu', (e) => {
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
                this.#renderPagination(tableContainer, this.#currentUserPage, totalPages, (p) => {
                    this.#currentUserPage = p;
                    this.#refreshUsersTable();
                });
            }
        } catch (e) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc(e.message)}</div>`;
        }
    }

    #showUserContextMenu(e, user) {
        const actions = [];
        actions.push({
            label: 'Изменить имя',
            handler: () => this.#editUsername(user)
        });
        actions.push({
            label: 'Изменить email',
            handler: () => this.#editEmail(user)
        });
        actions.push({
            label: 'Сменить пароль',
            handler: () => this.#changePassword(user)
        });
        actions.push({
            label: 'Изменить тариф',
            handler: () => this.#changePlan(user)
        });
        if (user.id !== this.#user.id && user.plan === 'freeze' && user.status !== 'banned') {
            actions.push({
                label: 'Забанить',
                danger: true,
                handler: () => this.#banUser(user)
            });
        }
        this.#contextMenu.show(e.clientX, e.clientY, actions);
    }

    async #editUsername(user) {
        const result = await this.#modal.open('Изменить имя', [
            { name: 'username', label: 'Имя пользователя', type: 'text', value: user.username }
        ]);
        if (!result || result.username === user.username) return;
        try {
            await this.#adminApi.updateUser(user.id, {
                username: result.username,
                email: user.email
            });
            this.#refreshUsersTable();
        } catch (e) {
            alert(e.message);
        }
    }

    async #editEmail(user) {
        const result = await this.#modal.open('Изменить email', [
            { name: 'email', label: 'Email', type: 'text', value: user.email }
        ]);
        if (!result || result.email === user.email) return;
        try {
            await this.#adminApi.updateUser(user.id, {
                username: user.username,
                email: result.email
            });
            this.#refreshUsersTable();
        } catch (e) {
            alert(e.message);
        }
    }

    async #changePassword(user) {
        const result = await this.#modal.open('Сменить пароль', [
            { name: 'password', label: 'Новый пароль (минимум 8 символов)', type: 'password' }
        ]);
        if (!result || !result.password) return;
        try {
            await this.#adminApi.resetPassword(user.id, result.password);
            alert('Пароль изменён');
        } catch (e) {
            alert(e.message);
        }
    }

    async #changePlan(user) {
        const result = await this.#modal.open('Изменить тариф', [
            {
                name: 'plan',
                label: 'Тариф',
                type: 'select',
                value: user.plan,
                options: PLAN_OPTIONS
            }
        ]);
        if (!result || result.plan === user.plan) return;
        try {
            await this.#adminApi.setPlan(user.id, result.plan);
            this.#refreshUsersTable();
        } catch (e) {
            alert(e.message);
        }
    }

    async #banUser(user) {
        if (!confirm(`Забанить "${user.username}"? Публичн��е блокноты станут приватными.`)) return;
        try {
            await this.#adminApi.banUser(user.id);
            this.#refreshUsersTable();
        } catch (e) {
            alert(e.message);
        }
    }

    #initNotebooksSection() {
        this.#currentNbPage = 1;
        this.#currentNbSearch = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Блокноты';
        this.#contentArea.appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по названию...';
        searchInput.addEventListener('input', () => {
            clearTimeout(this.#searchTimeout);
            this.#searchTimeout = setTimeout(() => {
                this.#currentNbSearch = searchInput.value;
                this.#currentNbPage = 1;
                this.#refreshNotebooksTable();
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'nb-count';
        header.appendChild(countEl);
        this.#contentArea.appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        this.#contentArea.appendChild(tableContainer);

        this.#refreshNotebooksTable();
    }

    async #refreshNotebooksTable() {
        const tableContainer = this.#contentArea.querySelector('.admin-table-container');
        const countEl = this.#contentArea.querySelector('[data-role="nb-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const limit = 15;
        const offset = (this.#currentNbPage - 1) * limit;

        try {
            const data = await this.#adminApi.getNotebooks(limit, offset, this.#currentNbSearch);
            const notebooks = data.notebooks || [];
            const total = data.total || 0;
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
                    <td class="admin-table__cell-truncate" title="${this.#esc(nb.title)}"><strong>${this.#esc(nb.title)}</strong></td>
                    <td class="admin-table__muted">${nb.owner_id}</td>
                    <td>${accessBadge}</td>
                    <td class="admin-table__muted">${new Date(nb.created_at).toLocaleDateString('ru-RU')}</td>`;

                tr.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.#contextMenu.show(e.clientX, e.clientY, [
                        {
                            label: 'Удалить',
                            danger: true,
                            handler: async () => {
                                if (confirm(`Удалить блокнот "${nb.title}"?`)) {
                                    try {
                                        await this.#adminApi.deleteNotebook(nb.id);
                                        this.#refreshNotebooksTable();
                                    } catch (err) {
                                        alert(err.message);
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
                this.#renderPagination(tableContainer, this.#currentNbPage, totalPages, (p) => {
                    this.#currentNbPage = p;
                    this.#refreshNotebooksTable();
                });
            }
        } catch (e) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc(e.message)}</div>`;
        }
    }

    #renderPagination(container, current, total, onPage) {
        const nav = document.createElement('div');
        nav.className = 'admin-pagination';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'admin-pagination__btn';
        prevBtn.textContent = '<';
        prevBtn.disabled = current <= 1;
        prevBtn.addEventListener('click', () => onPage(current - 1));
        nav.appendChild(prevBtn);

        const start = Math.max(1, current - 2);
        const end = Math.min(total, current + 2);

        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.className = 'admin-pagination__btn';
            if (i === current) btn.classList.add('admin-pagination__btn--active');
            btn.textContent = String(i);
            btn.addEventListener('click', () => onPage(i));
            nav.appendChild(btn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'admin-pagination__btn';
        nextBtn.textContent = '>';
        nextBtn.disabled = current >= total;
        nextBtn.addEventListener('click', () => onPage(current + 1));
        nav.appendChild(nextBtn);

        container.appendChild(nav);
    }

    #planBadge(plan) {
        const b = PLAN_BADGES[plan] || PLAN_BADGES.free;
        return `<span class="admin-badge ${b.cls}">${b.label}</span>`;
    }

    #formatRelativeTime(dateStr) {
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

    #formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '0 мин.';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs} ч. ${mins} мин.`;
        return `${mins} мин.`;
    }

    #esc(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    #plural(n, one, few, many) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 19) return many;
        if (mod10 === 1) return one;
        if (mod10 >= 2 && mod10 <= 4) return few;
        return many;
    }

    #initIssuesSection() {
        this.#currentIssuePage = 1;
        this.#currentIssueSearch = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Обращения';
        this.#contentArea.appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по содержанию...';
        searchInput.addEventListener('input', () => {
            clearTimeout(this.#searchTimeout);
            this.#searchTimeout = setTimeout(() => {
                this.#currentIssueSearch = searchInput.value;
                this.#currentIssuePage = 1;
                this.#refreshIssuesTable();
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'issue-count';
        header.appendChild(countEl);
        this.#contentArea.appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        this.#contentArea.appendChild(tableContainer);

        this.#refreshIssuesTable();
    }

    async #refreshIssuesTable() {
        const tableContainer = this.#contentArea.querySelector('.admin-table-container');
        const countEl = this.#contentArea.querySelector('[data-role="issue-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const limit = 15;
        const offset = (this.#currentIssuePage - 1) * limit;

        try {
            const data = await this.#adminApi.getIssues(limit, offset, this.#currentIssueSearch);
            const issues = data.issues || [];
            const total = data.total || 0;
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
                const catBadge = this.#issueBadge(ISSUE_CATEGORY_BADGES, issue.category);
                const statusBadge = this.#issueBadge(ISSUE_STATUS_BADGES, issue.status);
                const preview =
                    issue.content.length > 60
                        ? issue.content.substring(0, 60) + '...'
                        : issue.content;

                tr.innerHTML = `
                    <td class="admin-table__muted">${issue.id}</td>
                    <td>${catBadge}</td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(issue.content)}">${this.#esc(preview)}</td>
                    <td class="admin-table__muted">${issue.user_id}</td>
                    <td>${statusBadge}</td>
                    <td class="admin-table__muted">${new Date(issue.created_at).toLocaleDateString('ru-RU')}</td>`;

                tr.addEventListener('click', () => this.#showIssueDetail(issue.id));
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);

            const totalPages = Math.ceil(total / limit);
            if (totalPages > 1) {
                this.#renderPagination(tableContainer, this.#currentIssuePage, totalPages, (p) => {
                    this.#currentIssuePage = p;
                    this.#refreshIssuesTable();
                });
            }
        } catch (e) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc(e.message)}</div>`;
        }
    }

    async #showIssueDetail(issueId) {
        this.#contentArea.innerHTML = '';

        const backBtn = document.createElement('button');
        backBtn.className = 'admin-issue-detail__back-btn';
        backBtn.innerHTML = '&larr; Назад к обращениям';
        backBtn.addEventListener('click', () => this.#showSection('issues'));
        this.#contentArea.appendChild(backBtn);

        const container = document.createElement('div');
        container.className = 'admin-issue-detail';
        container.innerHTML = '<div class="admin-empty">Загрузка...</div>';
        this.#contentArea.appendChild(container);

        try {
            const issue = await this.#adminApi.getIssue(issueId);
            const catBadge = this.#issueBadge(ISSUE_CATEGORY_BADGES, issue.category);
            const statusBadge = this.#issueBadge(ISSUE_STATUS_BADGES, issue.status);
            const date = new Date(issue.created_at).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let attachmentsHtml = '';
            if (issue.attachments && issue.attachments.length > 0) {
                attachmentsHtml = `
                    <div class="admin-issue-detail__section">
                        <h4 class="admin-issue-detail__section-title">Вложения</h4>
                        <div class="admin-issue-detail__attachments">
                            ${issue.attachments
                                .map(
                                    (att) =>
                                        `<a class="admin-issue-detail__attachment" href="/api/v1/issues/${issueId}/attachments/${att.id}" target="_blank">${this.#esc(att.filename || att.name || 'Файл')}</a>`
                                )
                                .join('')}
                        </div>
                    </div>`;
            }

            let messagesHtml = '';
            if (issue.messages && issue.messages.length > 0) {
                const msgs = issue.messages
                    .map((m) => {
                        const mDate = new Date(m.created_at).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        const author = m.is_admin
                            ? 'Администратор'
                            : m.username || `User #${m.user_id}`;
                        const cls = m.is_admin
                            ? 'admin-issue-detail__message--admin'
                            : 'admin-issue-detail__message--user';
                        return `<div class="admin-issue-detail__message ${cls}">
                            <div class="admin-issue-detail__message-meta">
                                <span class="admin-issue-detail__message-author">${this.#esc(author)}</span>
                                <span class="admin-issue-detail__message-date">${mDate}</span>
                            </div>
                            <div class="admin-issue-detail__message-text">${this.#esc(m.content)}</div>
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
                    <span class="admin-table__muted">User ID: ${issue.user_id}</span>
                    <span class="admin-table__muted">${date}</span>
                </div>
                <div class="admin-issue-detail__content">${this.#esc(issue.content)}</div>
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

            const statusSelect = container.querySelector('[data-role="status-select"]');
            const updateBtn = container.querySelector('[data-role="update-status"]');
            updateBtn.addEventListener('click', async () => {
                try {
                    await this.#adminApi.updateIssueStatus(issueId, statusSelect.value);
                    this.#showIssueDetail(issueId);
                } catch (e) {
                    alert(e.message);
                }
            });

            const responseTextarea = container.querySelector('.admin-issue-detail__textarea');
            const sendBtn = container.querySelector('[data-role="send-response"]');
            sendBtn.addEventListener('click', async () => {
                const text = responseTextarea.value.trim();
                if (!text) return;
                try {
                    await this.#adminApi.respondToIssue(issueId, text);
                    this.#showIssueDetail(issueId);
                } catch (e) {
                    alert(e.message);
                }
            });
        } catch (e) {
            container.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc(e.message)}</div>`;
        }
    }

    #issueBadge(badges, key) {
        const b = badges[key] || { cls: '', label: key };
        return `<span class="admin-badge ${b.cls}">${b.label}</span>`;
    }

    destroy() {
        this.#root.innerHTML = '';
    }
}
