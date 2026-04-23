import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { AdminApi } from '../../shared/api/AdminApi.js';
import { Router } from '../../shared/router/Router.js';
import { ContextMenu } from '../../shared/components/context-menu/ContextMenu.js';
import { Modal } from '../../shared/components/modal/Modal.js';

function AdminPageTemplate() {
    return `<main class="admin-page">
    <div class="admin-page__container">
        <nav class="admin-page__sidebar">
            <div class="admin-page__sidebar-group">
                <h3 class="admin-page__sidebar-title">Управление</h3>
                <button class="admin-page__sidebar-item admin-page__sidebar-item--active" data-section="stats">Статистика</button>
                <button class="admin-page__sidebar-item" data-section="users">Пользователи</button>
                <button class="admin-page__sidebar-item" data-section="notebooks">Блокноты</button>
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
            this.#renderTimeSeriesChart(
                'DAU (последние 30 дней)',
                activityData.dau || [],
                'date',
                'count'
            );
            this.#renderTimeSeriesChart(
                'MAU (последние 12 месяцев)',
                activityData.mau || [],
                'month',
                'count'
            );
        } catch (e) {
            this.#contentArea.innerHTML += `<div class="admin-empty">Ошибка загрузки: ${this.#esc(e.message)}</div>`;
        }
    }

    #renderTimeSeriesChart(titleText, entries, keyField, valueField) {
        const chart = document.createElement('div');
        chart.className = 'admin-chart';
        chart.innerHTML = `<div class="admin-chart__title">${this.#esc(titleText)}</div>`;

        if (!entries || entries.length === 0) {
            chart.innerHTML += '<div class="admin-empty" style="padding:20px 0">Нет данных</div>';
            this.#contentArea.appendChild(chart);
            return;
        }

        const maxVal = Math.max(...entries.map((e) => e[valueField]), 1);
        const width = 700;
        const height = 180;
        const padding = { left: 40, right: 10, top: 20, bottom: 30 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const barW = Math.max(6, Math.floor(chartW / entries.length) - 3);

        let svg = `<svg viewBox="0 0 ${width} ${height}" class="admin-chart__svg">`;
        svg += `<line x1="${padding.left}" y1="${padding.top + chartH}" x2="${padding.left + chartW}" y2="${padding.top + chartH}" stroke="var(--cell-border)" stroke-width="1"/>`;

        for (let i = 0; i <= 4; i++) {
            const y = padding.top + chartH - (chartH / 4) * i;
            const val = Math.round((maxVal / 4) * i);
            svg += `<text x="${padding.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--accent)">${val}</text>`;
            if (i > 0)
                svg += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartW}" y2="${y}" stroke="var(--light-grey)" stroke-width="1"/>`;
        }

        entries.forEach((entry, i) => {
            const x = padding.left + i * (barW + 3) + 2;
            const barH = Math.max(1, (entry[valueField] / maxVal) * chartH);
            const y = padding.top + chartH - barH;

            svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="var(--teal-green)" rx="2"><title>${entry[keyField]}: ${entry[valueField]}</title></rect>`;

            if (entries.length <= 15 || i % Math.ceil(entries.length / 10) === 0) {
                const label =
                    entry[keyField].length > 5 ? entry[keyField].slice(5) : entry[keyField];
                svg += `<text x="${x + barW / 2}" y="${padding.top + chartH + 16}" text-anchor="middle" font-size="9" fill="var(--accent)">${label}</text>`;
            }
        });

        svg += '</svg>';
        chart.innerHTML += svg;
        this.#contentArea.appendChild(chart);
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

    destroy() {
        this.#root.innerHTML = '';
    }
}
