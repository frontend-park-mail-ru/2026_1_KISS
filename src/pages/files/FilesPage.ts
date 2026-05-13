import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { FilterBar } from '../../widgets/filter-bar/FilterBar.js';
import { FilesTable } from '../../widgets/files-table/FilesTable.js';
import { DiskUsageCard } from '../../widgets/disk-usage-card/DiskUsageCard.js';
import { Pagination } from '../../shared/components/pagination/Pagination.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import type { Notebook } from '../../shared/types.js';
import { nn } from '../../shared/utils/notNull.js';
import { logError } from '../../shared/utils/logger.js';
import { isAuthError } from '../../shared/http_client/authStatus.js';
import { renderServerUnavailable } from '../../shared/utils/serverUnavailable.js';
import type {
    ApiEnvelope,
    NotebookDTO,
    NotebookListResponse,
    UserDTO
} from '../../shared/api/types.js';

/**
 * Notebook с флагом _isShared: true для notebook'ов расшаренных мне другими.
 * В UI они отображаются вместе со своими, но без kebab-меню (нельзя удалить чужое).
 */
interface FilesNotebook extends Notebook {
    /** true если notebook расшарен мне (а не мой) */
    _isShared?: boolean;
}

/**
 * Главная страница списка файлов (`/files`). Показывает таблицу notebook'ов с
 * пагинацией (7 штук на страницу) + расшаренные мне ниже своих, FilterBar
 * (поиск+дата+владелец), кнопку "+ Создать файл" в FilterBar.
 *
 * Особенности:
 * - **Поиск** идёт через бэкенд (URL параметр) — на каждое изменение перезапрос.
 * - **Фильтры даты/владельца** применяются на клиенте к загруженной странице
 *   (не идеально для пагинации, но MVP-достаточно).
 * - **Расшаренные** загружаются отдельным эндпоинтом (limit=100) — без пагинации.
 * - При неавторизации — редирект на /sign.
 */
export class FilesPage {
    #root: HTMLElement;
    #header: GreenHeader | null = null;
    #filterBar: FilterBar | null = null;
    #filesTable: FilesTable | null = null;
    #diskUsageCard: DiskUsageCard | null = null;
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

    /**
     * Сохраняет root и берёт singleton HttpClient.
     * @param root - корневой элемент SPA
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
    }

    /**
     * Загружает данные пользователя через /auth/me, рендерит шапку с user-pill
     * (включая Админ-панель если is_admin), создаёт FilterBar/FilesTable/Pagination,
     * подгружает первую страницу + расшаренные. При неавторизации — редирект на /sign.
     */
    // eslint-disable-next-line max-statements -- TODO(refactor): split into #buildHeader + #initTables + #loadData; pre-existing tech debt
    public async render(): Promise<void> {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (isAuthError(response.status)) {
                nn(Router.getInstance()).navigate('/sign');
                return;
            }
            if (!response.ok) {
                renderServerUnavailable(this.#root);
                return;
            }
            const body = (await response.json()) as ApiEnvelope<UserDTO>;
            const user = body.data;
            this.#state.username = user.username;
            this.#state.avatarUrl = user.avatar_url;
            this.#state.isAdmin = user.is_admin;
        } catch (_e) {
            renderServerUnavailable(this.#root);
            return;
        }

        const initials = this.#state.username.substring(0, 2).toUpperCase();

        const headerConfig: Record<string, unknown> = {
            user: { username: this.#state.username, initials, avatarUrl: this.#state.avatarUrl },
            onProfile: () => {
                nn(Router.getInstance()).navigate('/profile');
            },
            onFeedback: () => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            onLogout: async () => {
                try {
                    const response = await this.#httpClient.post('/auth/logout');
                    if (response.ok || isAuthError(response.status)) {
                        nn(Router.getInstance()).navigate('/sign');
                        return;
                    }
                    logError('Logout failed with HTTP status', response.status);
                } catch (e: unknown) {
                    logError('Logout request failed', e);
                }
            }
        };
        if (this.#state.isAdmin) {
            headerConfig.onAdmin = (): void => {
                nn(Router.getInstance()).navigate('/admin');
            };
        }
        this.#header = new GreenHeader(this.#root, headerConfig);
        this.#header.render();

        const main = document.createElement('main');
        main.className = 'files-page';
        this.#root.appendChild(main);

        const container = document.createElement('div');
        container.className = 'files-page__container';
        main.appendChild(container);

        this.#diskUsageCard = new DiskUsageCard(container, {
            compact: true,
            onClick: (): void => {
                nn(Router.getInstance()).navigate('/disk');
            }
        });
        this.#diskUsageCard.mount();

        this.#filterBar = new FilterBar(container, {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onCreate: (): Promise<void> => this.#createNotebook(),
            onFilterChange: (filters): void => {
                this.#onFilterChange(filters as Record<string, unknown>);
            }
        });
        this.#filterBar.mount();

        this.#filesTable = new FilesTable(container, {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onDelete: (id: string): Promise<void> => this.#deleteNotebook(id),
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onRename: (id: string, newTitle: string): Promise<void> =>
                this.#renameNotebook(id, newTitle),
            onOpen: (id: string): void => {
                nn(Router.getInstance()).navigate(`/notebooks/${id}`);
            }
        });
        this.#filesTable.mount();

        this.#pagination = new Pagination(container, (page: number) => {
            void this.#loadNotebooks(page + 1);
        });
        this.#pagination.mount();

        await this.#loadSharedNotebooks();
        await this.#loadNotebooks(1);
    }

    /**
     * Размонтирует все три виджета и очищает root. Вызывается роутером.
     */
    public destroy(): void {
        if (this.#diskUsageCard) this.#diskUsageCard.unmount();
        if (this.#filterBar) this.#filterBar.unmount();
        if (this.#filesTable) this.#filesTable.unmount();
        if (this.#pagination) this.#pagination.unmount();
        this.#root.innerHTML = '';
    }

    /**
     * Загружает страницу notebook'ов с сервера. Если запрошенная страница
     * больше реальной (после удалений) — fallback на последнюю существующую.
     * Применяет клиентские фильтры через #applyFilters.
     * @param page - номер страницы (1-based)
     */
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

            const body = (await response.json()) as ApiEnvelope<NotebookListResponse>;
            const notebooks = body.data.notebooks as unknown as FilesNotebook[];
            const total = body.data.total;
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
            logError('Failed to load notebooks:', e);
        }
    }

    /**
     * Обработчик изменения фильтров от FilterBar. search идёт через сервер
     * (перезапрос с page=1); date/owner — клиентский #applyFilters.
     * @param filters - частичный объект с обновлёнными фильтрами
     */
    #onFilterChange(filters: Record<string, unknown>): void {
        const searchChanged = 'search' in filters && filters.search !== this.#filters.search;
        Object.assign(this.#filters, filters);
        if (searchChanged) {
            void this.#loadNotebooks(1);
        } else {
            this.#applyFilters();
        }
    }

    /**
     * Применяет клиентские фильтры (date/owner) к notebook'ам и расшаренным,
     * передаёт результат в FilesTable. Owner-фильтр работает только для
     * собственных notebook'ов (расшаренные не фильтруются по владельцу).
     */
    #applyFilters(): void {
        let filtered = [...this.#allNotebooks];

        if (this.#filters.owner !== null) {
            filtered = filtered.filter(() => this.#state.username === this.#filters.owner);
        }

        if (this.#filters.dateFrom !== null) {
            const from = new Date(this.#filters.dateFrom);
            filtered = filtered.filter((n) => new Date(n.updated_at) >= from);
        }

        if (this.#filters.dateTo !== null) {
            const to = new Date(this.#filters.dateTo);
            to.setHours(23, 59, 59, 999);
            filtered = filtered.filter((n) => new Date(n.updated_at) <= to);
        }

        let sharedFiltered = [...this.#sharedNotebooks];
        if (this.#filters.dateFrom !== null) {
            const from = new Date(this.#filters.dateFrom);
            sharedFiltered = sharedFiltered.filter((n) => new Date(n.updated_at) >= from);
        }
        if (this.#filters.dateTo !== null) {
            const to = new Date(this.#filters.dateTo);
            to.setHours(23, 59, 59, 999);
            sharedFiltered = sharedFiltered.filter((n) => new Date(n.updated_at) <= to);
        }

        nn(this.#filesTable).setData([...filtered, ...sharedFiltered], this.#state.username);
    }

    /**
     * Загружает все notebook'и расшаренные мне другими (limit=100) и помечает
     * их флагом _isShared=true. Ошибки молча игнорирует — список просто будет пуст.
     */
    async #loadSharedNotebooks(): Promise<void> {
        try {
            const response = await this.#httpClient.get('/notebooks/shared?limit=100&offset=0');
            if (!response.ok) return;
            const body = (await response.json()) as ApiEnvelope<NotebookListResponse>;
            this.#sharedNotebooks = (body.data.notebooks as unknown as FilesNotebook[]).map(
                (n) => ({
                    ...n,
                    _isShared: true as const
                })
            );
        } catch {
            this.#sharedNotebooks = [];
        }
    }

    /**
     * Создаёт новый notebook с дефолтным title 'Untitled' и сразу навигирует
     * на его страницу для редактирования.
     */
    async #createNotebook(): Promise<void> {
        try {
            const response = await this.#httpClient.post('/notebooks', {
                title: 'Untitled'
            });
            if (response.ok) {
                const body = (await response.json()) as ApiEnvelope<NotebookDTO>;
                nn(Router.getInstance()).navigate(`/notebooks/${String(body.data.id)}`);
            }
        } catch (e: unknown) {
            logError('Failed to create notebook:', e);
        }
    }

    /**
     * Удаляет notebook через DELETE и перезагружает текущую страницу.
     * @param id - ID удаляемого notebook'а
     */
    async #deleteNotebook(id: string): Promise<void> {
        try {
            const response = await this.#httpClient.delete(`/notebooks/${id}`);
            if (response.ok) {
                await this.#loadNotebooks(this.#state.currentPage);
            }
        } catch (e: unknown) {
            logError('Failed to delete notebook:', e);
        }
    }

    /**
     * Переименовывает notebook через PUT и перезагружает текущую страницу.
     * @param id - ID notebook'а
     * @param newTitle - новый title
     */
    async #renameNotebook(id: string, newTitle: string): Promise<void> {
        try {
            const response = await this.#httpClient.put(`/notebooks/${id}`, {
                title: newTitle
            });
            if (response.ok) {
                await this.#loadNotebooks(this.#state.currentPage);
            }
        } catch (e: unknown) {
            logError('Failed to rename notebook:', e);
        }
    }
}
