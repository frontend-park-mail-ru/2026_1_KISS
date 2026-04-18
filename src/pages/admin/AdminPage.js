import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { AdminApi } from '../../shared/api/AdminApi.js';
import { Router } from '../../shared/router/Router.js';

export class AdminPage {
    #root;
    #httpClient;
    #adminApi;
    #currentTab = 'stats';
    #user = null;

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
            user: { username: this.#user.username, initials, avatarUrl: this.#user.avatar_url || '' },
            onProfile: () => Router.getInstance().navigate('/profile'),
            onLogout: async () => {
                await this.#httpClient.post('/auth/logout').catch(() => {});
                Router.getInstance().navigate('/sign');
            },
        });
        header.render();

        const main = document.createElement('main');
        main.className = 'admin-page';
        this.#root.appendChild(main);

        const tabs = document.createElement('div');
        tabs.className = 'admin-page__tabs';
        main.appendChild(tabs);

        const tabNames = [
            { id: 'stats', label: 'Statistics' },
            { id: 'users', label: 'Users' },
            { id: 'notebooks', label: 'Notebooks' },
        ];

        tabNames.forEach(({ id, label }) => {
            const btn = document.createElement('button');
            btn.className = 'admin-page__tab';
            btn.textContent = label;
            btn.dataset.tab = id;
            if (id === this.#currentTab) btn.classList.add('admin-page__tab--active');
            btn.addEventListener('click', () => this.#switchTab(id));
            tabs.appendChild(btn);
        });

        this.#content = document.createElement('div');
        this.#content.className = 'admin-page__content';
        main.appendChild(this.#content);

        await this.#renderTab();
    }

    #content = null;

    #switchTab(tabId) {
        this.#currentTab = tabId;
        this.#root.querySelectorAll('.admin-page__tab').forEach((btn) => {
            btn.classList.toggle('admin-page__tab--active', btn.dataset.tab === tabId);
        });
        this.#renderTab();
    }

    async #renderTab() {
        this.#content.innerHTML = '';
        switch (this.#currentTab) {
            case 'stats':
                await this.#renderStats();
                break;
            case 'users':
                await this.#renderUsers();
                break;
            case 'notebooks':
                await this.#renderNotebooks();
                break;
        }
    }

    async #renderStats() {
        try {
            const stats = await this.#adminApi.getStats();
            const cards = [
                { label: 'Total Users', value: stats.total_users },
                { label: 'Active Sessions', value: stats.total_sessions },
                { label: 'DAU', value: stats.dau },
                { label: 'MAU', value: stats.mau },
            ];
            const grid = document.createElement('div');
            grid.className = 'admin-stats-grid';
            cards.forEach(({ label, value }) => {
                const card = document.createElement('div');
                card.className = 'admin-stat-card';
                card.innerHTML = `<div class="admin-stat-card__value">${value}</div><div class="admin-stat-card__label">${label}</div>`;
                grid.appendChild(card);
            });
            this.#content.appendChild(grid);
        } catch (e) {
            this.#content.textContent = 'Failed to load stats: ' + e.message;
        }
    }

    async #renderUsers(page = 1) {
        const limit = 20;
        const offset = (page - 1) * limit;
        try {
            const data = await this.#adminApi.getUsers(limit, offset);
            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<thead><tr>
                <th>ID</th><th>Username</th><th>Email</th><th>Admin</th><th>Status</th><th>Created</th><th>Actions</th>
            </tr></thead>`;
            const tbody = document.createElement('tbody');
            (data.users || []).forEach((user) => {
                const tr = document.createElement('tr');
                const isBanned = user.status === 'banned';
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td>${this.#escapeHtml(user.username)}</td>
                    <td>${this.#escapeHtml(user.email)}</td>
                    <td>${user.is_admin ? 'Yes' : 'No'}</td>
                    <td>${this.#escapeHtml(user.status || 'active')}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td></td>`;
                const actionsCell = tr.querySelector('td:last-child');
                const btn = document.createElement('button');
                btn.className = isBanned ? 'admin-btn admin-btn--unban' : 'admin-btn admin-btn--ban';
                btn.textContent = isBanned ? 'Unban' : 'Ban';
                btn.addEventListener('click', async () => {
                    try {
                        if (isBanned) {
                            await this.#adminApi.unbanUser(user.id);
                        } else {
                            await this.#adminApi.banUser(user.id);
                        }
                        await this.#renderUsers(page);
                    } catch (e) {
                        console.error('Ban/unban failed:', e);
                    }
                });
                actionsCell.appendChild(btn);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            this.#content.innerHTML = '';
            this.#content.appendChild(table);
        } catch (e) {
            this.#content.textContent = 'Failed to load users: ' + e.message;
        }
    }

    async #renderNotebooks(page = 1) {
        const limit = 20;
        const offset = (page - 1) * limit;
        try {
            const data = await this.#adminApi.getNotebooks(limit, offset);
            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<thead><tr>
                <th>ID</th><th>Owner ID</th><th>Title</th><th>Public</th><th>Created</th><th>Actions</th>
            </tr></thead>`;
            const tbody = document.createElement('tbody');
            (data.notebooks || []).forEach((nb) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${nb.id}</td>
                    <td>${nb.owner_id}</td>
                    <td>${this.#escapeHtml(nb.title)}</td>
                    <td>${nb.is_public ? 'Yes' : 'No'}</td>
                    <td>${new Date(nb.created_at).toLocaleDateString()}</td>
                    <td></td>`;
                const actionsCell = tr.querySelector('td:last-child');
                const btn = document.createElement('button');
                btn.className = 'admin-btn admin-btn--delete';
                btn.textContent = 'Delete';
                btn.addEventListener('click', async () => {
                    if (confirm(`Delete notebook "${nb.title}"?`)) {
                        try {
                            await this.#adminApi.deleteNotebook(nb.id);
                            await this.#renderNotebooks(page);
                        } catch (e) {
                            console.error('Delete failed:', e);
                        }
                    }
                });
                actionsCell.appendChild(btn);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            this.#content.innerHTML = '';
            this.#content.appendChild(table);
        } catch (e) {
            this.#content.textContent = 'Failed to load notebooks: ' + e.message;
        }
    }

    #escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    destroy() {
        this.#root.innerHTML = '';
    }
}
