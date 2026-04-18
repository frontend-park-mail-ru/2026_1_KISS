import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { AdminApi } from '../../shared/api/AdminApi.js';
import { Router } from '../../shared/router/Router.js';

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

export class AdminPage {
    #root;
    #httpClient;
    #adminApi;
    #user = null;
    #activeKey = 'stats';
    #contentArea = null;
    #searchTimeout = null;

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
                this.#renderUsers(1);
                break;
            case 'notebooks':
                this.#renderNotebooks(1);
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
                    label: 'Активные сессии',
                    value: stats.total_sessions || 0,
                    tooltip: 'Количество сессий, которые ещё не истекли (TTL 24 часа)'
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

            this.#renderBarChart('Активность (DAU / MAU)', [
                { label: 'DAU', value: stats.dau || 0 },
                { label: 'MAU', value: stats.mau || 0 },
                { label: 'Users', value: stats.total_users || 0 },
                { label: 'Sessions', value: stats.total_sessions || 0 }
            ]);
        } catch (e) {
            this.#contentArea.innerHTML += `<div class="admin-empty">Ошибка загрузки: ${this.#esc(e.message)}</div>`;
        }
    }

    #renderBarChart(titleText, items) {
        const maxVal = Math.max(...items.map((i) => i.value), 1);

        const chart = document.createElement('div');
        chart.className = 'admin-chart';
        chart.innerHTML = `<div class="admin-chart__title">${this.#esc(titleText)}</div>`;

        const bars = document.createElement('div');
        bars.className = 'admin-chart__bars';

        items.forEach(({ label, value }) => {
            const pct = Math.max((value / maxVal) * 100, 2);
            const group = document.createElement('div');
            group.className = 'admin-chart__bar-group';
            group.innerHTML = `
                <div class="admin-chart__bar-value">${value}</div>
                <div class="admin-chart__bar" style="height: ${pct}%"></div>
                <div class="admin-chart__bar-label">${this.#esc(label)}</div>`;
            bars.appendChild(group);
        });

        chart.appendChild(bars);
        this.#contentArea.appendChild(chart);
    }

    async #renderUsers(page, search = '') {
        this.#contentArea.innerHTML = '';

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
        searchInput.value = search;
        searchInput.addEventListener('input', () => {
            clearTimeout(this.#searchTimeout);
            this.#searchTimeout = setTimeout(() => {
                this.#renderUsers(1, searchInput.value);
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        header.appendChild(countEl);

        this.#contentArea.appendChild(header);

        const limit = 15;
        const offset = (page - 1) * limit;

        try {
            const data = await this.#adminApi.getUsers(limit, offset, search);
            const users = data.users || [];
            const total = data.total || 0;
            countEl.textContent = `${total} пользовател${this.#plural(total, 'ь', 'я', 'ей')}`;

            if (users.length === 0) {
                this.#contentArea.innerHTML +=
                    '<div class="admin-empty">Пользователи не найдены</div>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<thead><tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Регистрация</th>
                <th>Действия</th>
            </tr></thead>`;

            const tbody = document.createElement('tbody');
            users.forEach((user) => {
                const isBanned = user.status === 'banned';
                const tr = document.createElement('tr');

                let roleBadge = '<span class="admin-badge admin-badge--active">user</span>';
                if (user.is_admin)
                    roleBadge = '<span class="admin-badge admin-badge--admin">admin</span>';

                let statusBadge = '<span class="admin-badge admin-badge--active">active</span>';
                if (isBanned)
                    statusBadge = '<span class="admin-badge admin-badge--banned">banned</span>';

                tr.innerHTML = `
                    <td class="admin-table__muted">${user.id}</td>
                    <td><strong>${this.#esc(user.username)}</strong></td>
                    <td>${this.#esc(user.email)}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td class="admin-table__muted">${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                    <td></td>`;

                const actionsCell = tr.querySelector('td:last-child');
                if (user.id !== this.#user.id && !user.is_admin) {
                    const btn = document.createElement('button');
                    btn.className = isBanned
                        ? 'admin-btn admin-btn--unban'
                        : 'admin-btn admin-btn--ban';
                    btn.textContent = isBanned ? 'Разбанить' : 'Забанить';
                    btn.addEventListener('click', async () => {
                        try {
                            if (isBanned) await this.#adminApi.unbanUser(user.id);
                            else await this.#adminApi.banUser(user.id);
                            this.#renderUsers(page, search);
                        } catch (e) {
                            console.error('Ban/unban failed:', e);
                        }
                    });
                    actionsCell.appendChild(btn);
                }
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            this.#contentArea.appendChild(table);

            const totalPages = Math.ceil(total / limit);
            if (totalPages > 1) {
                this.#renderPagination(page, totalPages, (p) => this.#renderUsers(p, search));
            }
        } catch (e) {
            this.#contentArea.innerHTML += `<div class="admin-empty">Ошибка: ${this.#esc(e.message)}</div>`;
        }
    }

    async #renderNotebooks(page, search = '') {
        this.#contentArea.innerHTML = '';

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
        searchInput.value = search;
        searchInput.addEventListener('input', () => {
            clearTimeout(this.#searchTimeout);
            this.#searchTimeout = setTimeout(() => {
                this.#renderNotebooks(1, searchInput.value);
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        header.appendChild(countEl);

        this.#contentArea.appendChild(header);

        const limit = 15;
        const offset = (page - 1) * limit;

        try {
            const data = await this.#adminApi.getNotebooks(limit, offset, search);
            const notebooks = data.notebooks || [];
            const total = data.total || 0;
            countEl.textContent = `${total} блокнот${this.#plural(total, '', 'а', 'ов')}`;

            if (notebooks.length === 0) {
                this.#contentArea.innerHTML += '<div class="admin-empty">Блокноты не найдены</div>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<thead><tr>
                <th>ID</th>
                <th>Название</th>
                <th>Owner ID</th>
                <th>Доступ</th>
                <th>Создан</th>
                <th>Действия</th>
            </tr></thead>`;

            const tbody = document.createElement('tbody');
            notebooks.forEach((nb) => {
                const tr = document.createElement('tr');
                const accessBadge = nb.is_public
                    ? '<span class="admin-badge admin-badge--active">public</span>'
                    : '<span class="admin-badge">private</span>';

                tr.innerHTML = `
                    <td class="admin-table__muted">${nb.id}</td>
                    <td><strong>${this.#esc(nb.title)}</strong></td>
                    <td class="admin-table__muted">${nb.owner_id}</td>
                    <td>${accessBadge}</td>
                    <td class="admin-table__muted">${new Date(nb.created_at).toLocaleDateString('ru-RU')}</td>
                    <td></td>`;

                const actionsCell = tr.querySelector('td:last-child');
                const btn = document.createElement('button');
                btn.className = 'admin-btn admin-btn--delete';
                btn.textContent = 'Удалить';
                btn.addEventListener('click', async () => {
                    if (confirm(`Удалить блокнот "${nb.title}"?`)) {
                        try {
                            await this.#adminApi.deleteNotebook(nb.id);
                            this.#renderNotebooks(page, search);
                        } catch (e) {
                            console.error('Delete failed:', e);
                        }
                    }
                });
                actionsCell.appendChild(btn);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            this.#contentArea.appendChild(table);

            const totalPages = Math.ceil(total / limit);
            if (totalPages > 1) {
                this.#renderPagination(page, totalPages, (p) => this.#renderNotebooks(p, search));
            }
        } catch (e) {
            this.#contentArea.innerHTML += `<div class="admin-empty">Ошибка: ${this.#esc(e.message)}</div>`;
        }
    }

    #renderPagination(current, total, onPage) {
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

        this.#contentArea.appendChild(nav);
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
