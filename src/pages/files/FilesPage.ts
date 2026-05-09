import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { FilterBar } from '../../widgets/filter-bar/FilterBar.js';
import { FilesTable } from '../../widgets/files-table/FilesTable.js';
import { Pagination } from '../../shared/components/pagination/Pagination.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import type { Notebook } from '../../shared/types.js';
import { nn } from '../../shared/utils/notNull.js';

interface FilesNotebook extends Notebook {
    _isShared?: boolean;
}

export class FilesPage {
    #root: HTMLElement;
    #header: GreenHeader | null = null;
    #filterBar: FilterBar | null = null;
    #filesTable: FilesTable | null = null;
    #pagination: Pagination | null = null;
    #allNotebooks: FilesNotebook[] = [];
    #filters: {
        owner: string | null;
        dateFrom: string | null;
        dateTo: string | null;
        search: string;
    } = { owner: null, dateFrom: null, dateTo: null, search: '' };
    #feedbackModal: FeedbackModal | null = null;
    #state: {
        notebooks: FilesNotebook[];
        currentPage: number;
        limit: number;
        username: string;
        avatarUrl?: string;
        isAdmin?: boolean;
    } = {
        notebooks: [],
        currentPage: 1,
        limit: 7,
        username: ''
    };

    #sharedNotebooks: FilesNotebook[] = [];

    #httpClient: HttpClient;

    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
    }

    public async render(): Promise<void> {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                nn(Router.getInstance()).navigate('/sign');
                return;
            }
            const { data: user } = await response.json();
            this.#state.username = user.username;
            this.#state.avatarUrl = user.avatar_url ?? '';
            this.#state.isAdmin = user.is_admin ?? false;
        } catch (_e) {
            nn(Router.getInstance()).navigate('/sign');
            return;
        }

        const initials = this.#state.username.substring(0, 2).toUpperCase();

        const headerConfig: Record<string, unknown> = {
            user: { username: this.#state.username, initials, avatarUrl: this.#state.avatarUrl },
            onProfile: () => { nn(Router.getInstance()).navigate('/profile'); },
            onFeedback: () => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            onLogout: async () => {
                try {
                    await this.#httpClient.post('/auth/logout');
                } catch (_e) {
                    /* ignore */
                }
                nn(Router.getInstance()).navigate('/sign');
            }
        };
        if (this.#state.isAdmin) {
            headerConfig.onAdmin = () => { nn(Router.getInstance()).navigate('/admin'); };
        }
        this.#header = new GreenHeader(this.#root, headerConfig);
        this.#header.render();

        const main = document.createElement('main');
        main.className = 'files-page';
        this.#root.appendChild(main);

        const container = document.createElement('div');
        container.className = 'files-page__container';
        main.appendChild(container);

        this.#filterBar = new FilterBar(container, {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onCreate: () => this.#createNotebook(),
            onFilterChange: (filters) => { this.#onFilterChange(filters as Record<string, unknown>); }
        });
        this.#filterBar.mount();

        this.#filesTable = new FilesTable(container, {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onDelete: (id: string) => this.#deleteNotebook(id),
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onRename: (id: string, newTitle: string) => this.#renameNotebook(id, newTitle),
            onOpen: (id: string) => { nn(Router.getInstance()).navigate(`/notebooks/${id}`); }
        });
        this.#filesTable.mount();

        this.#pagination = new Pagination(container, (page: number) => {
            void this.#loadNotebooks(page + 1);
        });
        this.#pagination.mount();

        await this.#loadSharedNotebooks();
        await this.#loadNotebooks(1);
    }

    public destroy(): void {
        if (this.#filterBar) this.#filterBar.unmount();
        if (this.#filesTable) this.#filesTable.unmount();
        if (this.#pagination) this.#pagination.unmount();
        this.#root.innerHTML = '';
    }

    async #loadNotebooks(page: number): Promise<void> {
        const requestedPage = Math.max(1, page);
        const offset = (requestedPage - 1) * this.#state.limit;

        const params = new URLSearchParams({
            limit: String(this.#state.limit),
            offset: String(offset)
        });
        if (this.#filters.search) params.set('search', this.#filters.search);

        try {
            const response = await this.#httpClient.get(`/notebooks?${params.toString()}`);

            if (!response.ok) return;

            const { data } = (await response.json()) as { data: Record<string, unknown> };
            const notebooks = data.notebooks as FilesNotebook[];
            const total = data.total as number;
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
            nn(this.#filterBar).setOwners(uniqueOwners);

            this.#applyFilters();

            nn(this.#pagination).update(requestedPage - 1, totalPages);
        } catch (e: unknown) {
            console.error('Failed to load notebooks:', e);
        }
    }

    #onFilterChange(filters: Record<string, unknown>): void {
        const searchChanged = 'search' in filters && filters.search !== this.#filters.search;
        Object.assign(this.#filters, filters);
        if (searchChanged) {
            void this.#loadNotebooks(1);
        } else {
            this.#applyFilters();
        }
    }

    #applyFilters(): void {
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

        let sharedFiltered = [...this.#sharedNotebooks];
        if (this.#filters.dateFrom) {
            const from = new Date(this.#filters.dateFrom);
            sharedFiltered = sharedFiltered.filter((n) => new Date(n.updated_at) >= from);
        }
        if (this.#filters.dateTo) {
            const to = new Date(this.#filters.dateTo);
            to.setHours(23, 59, 59, 999);
            sharedFiltered = sharedFiltered.filter((n) => new Date(n.updated_at) <= to);
        }

        nn(this.#filesTable).setData([...filtered, ...sharedFiltered], this.#state.username);
    }

    async #loadSharedNotebooks(): Promise<void> {
        try {
            const response = await this.#httpClient.get('/notebooks/shared?limit=100&offset=0');
            if (!response.ok) return;
            const { data } = (await response.json()) as { data: Record<string, unknown> };
            this.#sharedNotebooks = ((data.notebooks ?? []) as FilesNotebook[]).map((n) => ({
                ...n,
                _isShared: true as const
            }));
        } catch {
            this.#sharedNotebooks = [];
        }
    }

    async #createNotebook(): Promise<void> {
        try {
            const response = await this.#httpClient.post('/notebooks', {
                title: 'Untitled'
            });
            if (response.ok) {
                const { data: notebook } = (await response.json()) as {
                    data: Record<string, unknown>;
                };
                nn(Router.getInstance()).navigate(`/notebooks/${String(notebook.id)}`);
            }
        } catch (e: unknown) {
            console.error('Failed to create notebook:', e);
        }
    }

    async #deleteNotebook(id: string): Promise<void> {
        try {
            const response = await this.#httpClient.delete(`/notebooks/${id}`);
            if (response.ok) {
                await this.#loadNotebooks(this.#state.currentPage);
            }
        } catch (e: unknown) {
            console.error('Failed to delete notebook:', e);
        }
    }

    async #renameNotebook(id: string, newTitle: string): Promise<void> {
        try {
            const response = await this.#httpClient.put(`/notebooks/${id}`, {
                title: newTitle
            });
            if (response.ok) {
                await this.#loadNotebooks(this.#state.currentPage);
            }
        } catch (e: unknown) {
            console.error('Failed to rename notebook:', e);
        }
    }
}
