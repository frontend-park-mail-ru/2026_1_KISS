/**
 * @module pages/files/FilesPage
 *
 * Страница списка ноутбуков (/files).
 * Загружает ноутбуки с пагинацией, поддерживает фильтрацию по владельцу
 * и дате, CRUD-операции над ноутбуками.
 */

import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { FilterBar } from '../../widgets/filter-bar/FilterBar.js';
import { FilesTable } from '../../widgets/files-table/FilesTable.js';
import { Pagination } from '../../shared/components/pagination/Pagination.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';

/** @typedef {import('../../shared/types.js').Notebook} Notebook */
/** @typedef {import('../../shared/types.js').FilterSet} FilterSet */
/** @typedef {import('../../shared/types.js').FilesPageState} FilesPageState */

/**
 * Страница /files -- список ноутбуков с фильтрами, сортировкой и пагинацией.
 * При отсутствии авторизации редиректит на /sign.
 */
export class FilesPage {
    /** @type {HTMLElement} */
    #root;

    /** @type {GreenHeader} */
    #header;

    /** @type {FilterBar} */
    #filterBar;

    /** @type {FilesTable} */
    #filesTable;

    /** @type {Pagination} */
    #pagination;

    /** @type {HttpClient} */
    #httpClient;

    /** @type {Notebook[]} */
    #allNotebooks = [];

    /** @type {FilterSet} */
    #filters = { owner: null, dateFrom: null, dateTo: null };

    /** @type {FilesPageState} */
    #state = {
        notebooks: [],
        currentPage: 1,
        limit: 7,
        username: ''
    };

    /**
     * @param {HTMLElement} root -- корневой элемент
     */
    constructor(root) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
    }

    /**
     * Проверяет авторизацию, рендерит header, фильтры, таблицу и пагинацию,
     * загружает первую страницу ноутбуков.
     *
     * @async
     * @returns {Promise<void>}
     */
    async render() {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                Router.getInstance().navigate('/sign');
                return;
            }
            const { data: user } = await response.json();
            this.#state.username = user.username;
            this.#state.avatarUrl = user.avatar_url || '';
        } catch (_e) {
            Router.getInstance().navigate('/sign');
            return;
        }

        const initials = this.#state.username.substring(0, 2).toUpperCase();

        this.#header = new GreenHeader(this.#root, {
            user: { username: this.#state.username, initials, avatarUrl: this.#state.avatarUrl },
            onProfile: () => Router.getInstance().navigate('/profile'),
            onLogout: async () => {
                try {
                    await this.#httpClient.post('/auth/logout');
                } catch (_e) {
                    /* ignore */
                }
                Router.getInstance().navigate('/sign');
            }
        });
        this.#header.render();

        const main = document.createElement('main');
        main.className = 'files-page';
        this.#root.appendChild(main);

        const container = document.createElement('div');
        container.className = 'files-page__container';
        main.appendChild(container);

        this.#filterBar = new FilterBar(container, {
            onCreate: () => this.#createNotebook(),
            onFilterChange: (filters) => this.#onFilterChange(filters)
        });
        this.#filterBar.mount();

        this.#filesTable = new FilesTable(container, {
            onDelete: (id) => this.#deleteNotebook(id),
            onRename: (id, newTitle) => this.#renameNotebook(id, newTitle),
            onOpen: (id) => Router.getInstance().navigate(`/notebooks/${id}`)
        });
        this.#filesTable.mount();

        this.#pagination = new Pagination(container, (page) => {
            this.#loadNotebooks(page + 1);
        });
        this.#pagination.mount();

        await this.#loadNotebooks(1);
    }

    /**
     * Размонтирует виджеты и очищает DOM.
     */
    destroy() {
        if (this.#filterBar) this.#filterBar.unmount();
        if (this.#filesTable) this.#filesTable.unmount();
        if (this.#pagination) this.#pagination.unmount();
        this.#root.innerHTML = '';
    }

    /**
     * Загружает страницу ноутбуков с сервера и обновляет таблицу + пагинатор.
     *
     * @private
     * @async
     * @param {number} page -- номер страницы (1-based)
     */
    async #loadNotebooks(page) {
        const requestedPage = Math.max(1, page);
        const offset = (requestedPage - 1) * this.#state.limit;

        try {
            const response = await this.#httpClient.get(
                `/notebooks?limit=${this.#state.limit}&offset=${offset}`
            );

            if (!response.ok) return;

            const { data } = await response.json();
            const notebooks = data.notebooks;
            const total = data.total;
            const totalPages = Math.ceil(total / this.#state.limit);

            if (total > 0) {
                const lastPage = Math.max(1, totalPages);
                if (requestedPage > lastPage) {
                    await this.#loadNotebooks(lastPage);
                    return;
                }
            }

            this.#state.currentPage = requestedPage;

            this.#state.notebooks = notebooks;
            this.#allNotebooks = [...notebooks];

            const uniqueOwners = [...new Set([this.#state.username])];
            this.#filterBar.setOwners(uniqueOwners);

            this.#applyFilters();

            this.#pagination.update(requestedPage - 1, totalPages);
        } catch (e) {
            console.error('Failed to load notebooks:', e);
        }
    }

    /**
     * Обрабатывает изменение фильтров: мержит новые значения в текущие и перефильтровывает таблицу.
     *
     * @private
     * @param {FilterSet} filters -- изменённые фильтры
     */
    #onFilterChange(filters) {
        Object.assign(this.#filters, filters);
        this.#applyFilters();
    }

    /**
     * Фильтрует #allNotebooks по текущим фильтрам (владелец, dateFrom, dateTo) и обновляет таблицу.
     *
     * @private
     */
    #applyFilters() {
        let filtered = [...this.#allNotebooks];

        if (this.#filters.owner) {
            filtered = filtered.filter(() => this.#state.username === this.#filters.owner);
        }

        if (this.#filters.dateFrom) {
            const from = new Date(this.#filters.dateFrom);
            filtered = filtered.filter((n) => new Date(n.updated_at) >= from);
        }

        if (this.#filters.dateTo) {
            const to = new Date(this.#filters.dateTo);
            to.setHours(23, 59, 59, 999);
            filtered = filtered.filter((n) => new Date(n.updated_at) <= to);
        }

        this.#filesTable.setData(filtered, this.#state.username);
    }

    /**
     * Создаёт новый ноутбук через POST /notebooks и навигирует к нему.
     *
     * @private
     * @async
     */
    async #createNotebook() {
        try {
            const response = await this.#httpClient.post('/notebooks', {
                title: 'Untitled'
            });
            if (response.ok) {
                const { data: notebook } = await response.json();
                Router.getInstance().navigate(`/notebooks/${notebook.id}`);
            }
        } catch (e) {
            console.error('Failed to create notebook:', e);
        }
    }

    /**
     * @private
     * @async
     * @param {string} id -- идентификатор ноутбука
     */
    async #deleteNotebook(id) {
        try {
            const response = await this.#httpClient.delete(`/notebooks/${id}`);
            if (response.ok) {
                await this.#loadNotebooks(this.#state.currentPage);
            }
        } catch (e) {
            console.error('Failed to delete notebook:', e);
        }
    }

    /**
     * @private
     * @async
     * @param {string} id -- идентификатор ноутбука
     * @param {string} newTitle -- новое название
     */
    async #renameNotebook(id, newTitle) {
        try {
            const response = await this.#httpClient.put(`/notebooks/${id}`, {
                title: newTitle
            });
            if (response.ok) {
                await this.#loadNotebooks(this.#state.currentPage);
            }
        } catch (e) {
            console.error('Failed to rename notebook:', e);
        }
    }
}
