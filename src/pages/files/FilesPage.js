import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { FilterBar } from '../../widgets/filter-bar/FilterBar.js';
import { FilesTable } from '../../widgets/files-table/FilesTable.js';
import { Pagination } from '../../shared/components/pagination/Pagination.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';

export class FilesPage {
    #root;
    #header;
    #filterBar;
    #filesTable;
    #pagination;
    #httpClient;
    #allNotebooks = [];
    #filters = { owner: null, dateFrom: null, dateTo: null };
    #state = {
        notebooks: [],
        currentPage: 1,
        hasNextPage: false,
        limit: 7,
        username: ''
    };

    constructor(root) {
        this.#root = root;
        this.#httpClient = new HttpClient();
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
            this.#state.username = user.username;
        } catch (_e) {
            Router.getInstance().navigate('/sign');
            return;
        }

        const initials = this.#state.username.substring(0, 2).toUpperCase();

        this.#header = new GreenHeader(this.#root, {
            user: { username: this.#state.username, initials },
            onProfile: () => {
            },
            onLogout: async () => {
                try {
                    await this.#httpClient.post('/auth/logout');
                } catch (_e) {
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

    destroy() {
        if (this.#filterBar) this.#filterBar.unmount();
        if (this.#filesTable) this.#filesTable.unmount();
        if (this.#pagination) this.#pagination.unmount();
        this.#root.innerHTML = '';
    }

    async #loadNotebooks(page) {
        this.#state.currentPage = page;
        const offset = (page - 1) * this.#state.limit;

        try {
            const response = await this.#httpClient.get(
                `/notebooks?limit=${this.#state.limit + 1}&offset=${offset}`
            );
            
            if (!response.ok) return;

            const { data: notebooks } = await response.json();
            
            const hasNextPage = notebooks.length > this.#state.limit;
            
            let displayNotebooks = notebooks;
            if (hasNextPage) {
                displayNotebooks = notebooks.slice(0, this.#state.limit);
            }
            
            this.#state.notebooks = displayNotebooks;
            this.#allNotebooks = [...displayNotebooks];
            this.#state.hasNextPage = hasNextPage;
            const totalPages = hasNextPage ? page + 1 : page;
            
            console.log('=== Pagination Debug ===');
            console.log('Current page (1-index):', page);
            console.log('Current page (0-index):', page - 1);
            console.log('Has next page:', hasNextPage);
            console.log('Total pages (estimated):', totalPages);
            console.log('Notebooks received:', notebooks.length);
            console.log('Notebooks displayed:', displayNotebooks.length);

            const uniqueOwners = [...new Set([this.#state.username])];
            this.#filterBar.setOwners(uniqueOwners);

            this.#applyFilters();
            
            this.#pagination.update(page - 1, totalPages);

            if (hasNextPage || page > 1) {
                this.#pagination.show();
            } else {
                this.#pagination.hide();
            }
            
        } catch (e) {
            console.error('Failed to load notebooks:', e);
        }
    }

    #onFilterChange(filters) {
        Object.assign(this.#filters, filters);
        this.#applyFilters();
    }

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

    async #createNotebook() {
        try {
            const response = await this.#httpClient.post('/notebooks', {
                title: 'Untitled'
            });
            if (response.ok) {
                await this.#loadNotebooks(this.#state.currentPage);
            }
        } catch (e) {
            console.error('Failed to create notebook:', e);
        }
    }

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