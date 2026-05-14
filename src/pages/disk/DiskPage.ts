import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { FileDropZone } from '../../widgets/file-drop-zone/FileDropZone.js';
import { DiskTable } from '../../widgets/disk-table/DiskTable.js';
import { DiskUsageCard } from '../../widgets/disk-usage-card/DiskUsageCard.js';
import { FileShareModal } from '../../widgets/file-share-modal/FileShareModal.js';
import { RenameModal } from '../../widgets/rename-modal/RenameModal.js';
import { Pagination } from '../../shared/components/pagination/Pagination.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { StorageApi } from '../../shared/api/StorageApi.js';
import { NotebookApi } from '../../shared/api/NotebookApi.js';
import { ipynbToBlocks } from '../../shared/domain/notebook/nbformat.js';
import { Router } from '../../shared/router/Router.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import { nn } from '../../shared/utils/notNull.js';
import { logError } from '../../shared/utils/logger.js';
import { isAuthError } from '../../shared/http_client/authStatus.js';
import { renderServerUnavailable } from '../../shared/utils/serverUnavailable.js';
import type { ApiEnvelope, FileItemDTO, UserDTO } from '../../shared/api/types.js';
import { DiskPageTemplate } from './DiskPage.template.js';

const PAGE_SIZE = 10;

/**
 * Страница «Мой диск» (`/disk`). Содержит две вкладки: «Мои файлы»
 * (с drag-and-drop, квотой, действиями владельца) и «Расшарено со мной»
 * (файлы от других пользователей). Авторизованным пользователям;
 * неавторизованных редиректит на /sign.
 */
export class DiskPage {
    #root: HTMLElement;
    #httpClient: HttpClient;
    #storage: StorageApi;
    #header: GreenHeader | null = null;
    #usageCard: DiskUsageCard | null = null;
    #dropZone: FileDropZone | null = null;
    #table: DiskTable | null = null;
    #sharedTable: DiskTable | null = null;
    #pagination: Pagination | null = null;
    #sharedPagination: Pagination | null = null;
    #feedbackModal: FeedbackModal | null = null;
    #currentPage = 0;
    #totalPages = 1;
    #sharedPage = 0;
    #sharedTotalPages = 1;
    #activeTab: 'own' | 'shared' = 'own';

    /**
     * Сохраняет root и берёт singleton-клиенты.
     * @param root - корневой элемент SPA
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
        this.#storage = StorageApi.getInstance();
    }

    /**
     * Загружает текущего пользователя, монтирует шапку и виджеты обеих вкладок,
     * подгружает первую страницу собственных файлов. При недоступности бэка —
     * показывает «server unavailable». При 401 — редирект на /sign.
     */
    public async render(): Promise<void> {
        this.#root.innerHTML = '';

        let user: UserDTO;
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
            user = body.data;
        } catch (_e) {
            renderServerUnavailable(this.#root);
            return;
        }

        this.#root.innerHTML = DiskPageTemplate();
        this.#mountWidgets(user);
        this.#attachTabSwitching();
        await this.#loadList();
    }

    /**
     * Создаёт и монтирует все виджеты страницы.
     * @param user - данные текущего пользователя
     */
    #mountWidgets(user: UserDTO): void {
        const root = this.#root;
        const headerMount = nn(root.querySelector<HTMLElement>('.disk-page__header-mount'));
        const usageMount = nn(root.querySelector<HTMLElement>('.disk-page__usage-mount'));
        const dropMount = nn(root.querySelector<HTMLElement>('.disk-page__drop-mount'));
        const tableMount = nn(root.querySelector<HTMLElement>('.disk-page__table-mount'));
        const paginationMount = nn(root.querySelector<HTMLElement>('.disk-page__pagination-mount'));
        const sharedTableMount = nn(
            root.querySelector<HTMLElement>('.disk-page__shared-table-mount')
        );
        const sharedPaginationMount = nn(
            root.querySelector<HTMLElement>('.disk-page__shared-pagination-mount')
        );

        this.#header = new GreenHeader(headerMount, this.#buildHeaderConfig(user));
        this.#header.render();

        this.#usageCard = new DiskUsageCard(usageMount);
        this.#usageCard.mount();

        this.#dropZone = new FileDropZone(dropMount, {
            onFiles: (files): Promise<void> => this.#handleUpload(files)
        });
        this.#dropZone.mount();

        this.#table = new DiskTable(tableMount, {
            mode: 'own',
            onDelete: (file): void => {
                void this.#handleDelete(file);
            },
            onShare: (file): void => {
                void this.#handleShare(file);
            },
            onRename: (file): void => {
                this.#handleRename(file);
            }
        });
        this.#table.mount();

        this.#pagination = new Pagination(paginationMount, (page) => {
            this.#currentPage = page;
            void this.#loadList();
        });
        this.#pagination.mount();

        this.#sharedTable = new DiskTable(sharedTableMount, {
            mode: 'shared',
            onDelete: (): void => {
                /* нельзя удалять чужие */
            }
        });
        this.#sharedTable.mount();

        this.#sharedPagination = new Pagination(sharedPaginationMount, (page) => {
            this.#sharedPage = page;
            void this.#loadSharedList();
        });
        this.#sharedPagination.mount();
    }

    /**
     * Навешивает обработчики переключения вкладок.
     */
    #attachTabSwitching(): void {
        const tabs = this.#root.querySelectorAll<HTMLButtonElement>('.disk-page__tab');
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab === 'shared' ? 'shared' : 'own';
                void this.#switchTab(target);
            });
        });
    }

    /**
     * Переключает активную вкладку, обновляя визуальное состояние и подгружая
     * данные. Вызов идемпотентен — повторное переключение на ту же вкладку
     * ничего не делает.
     * @param next - новая активная вкладка
     */
    async #switchTab(next: 'own' | 'shared'): Promise<void> {
        if (next === this.#activeTab) return;
        this.#activeTab = next;
        const tabs = this.#root.querySelectorAll<HTMLButtonElement>('.disk-page__tab');
        tabs.forEach((t) => {
            t.classList.toggle('disk-page__tab_active', t.dataset.tab === next);
        });
        const ownPanel = nn(this.#root.querySelector<HTMLElement>('.disk-page__panel_own'));
        const sharedPanel = nn(this.#root.querySelector<HTMLElement>('.disk-page__panel_shared'));
        ownPanel.hidden = next !== 'own';
        sharedPanel.hidden = next !== 'shared';
        if (next === 'shared') {
            await this.#loadSharedList();
        }
    }

    /**
     * Собирает конфиг для GreenHeader из текущего пользователя.
     * @param user - данные пользователя из /auth/me
     * @returns объект конфигурации для GreenHeader
     */
    #buildHeaderConfig(user: UserDTO): Record<string, unknown> {
        const initials = user.username.substring(0, 2).toUpperCase();
        const headerConfig: Record<string, unknown> = {
            user: { username: user.username, initials, avatarUrl: user.avatar_url },
            onProfile: (): void => {
                nn(Router.getInstance()).navigate('/profile');
            },
            onFeedback: (): void => {
                this.#feedbackModal ??= new FeedbackModal();
                this.#feedbackModal.open();
            },
            onLogout: async (): Promise<void> => {
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
        if (user.is_admin) {
            headerConfig.onAdmin = (): void => {
                nn(Router.getInstance()).navigate('/admin');
            };
        }
        return headerConfig;
    }

    /**
     * Размонтирует все виджеты и очищает root.
     */
    public destroy(): void {
        this.#header?.destroy();
        this.#usageCard?.unmount();
        this.#dropZone?.unmount();
        this.#table?.unmount();
        this.#sharedTable?.unmount();
        this.#pagination?.unmount();
        this.#sharedPagination?.unmount();
        this.#header = null;
        this.#usageCard = null;
        this.#dropZone = null;
        this.#table = null;
        this.#sharedTable = null;
        this.#pagination = null;
        this.#sharedPagination = null;
    }

    /**
     * Подгружает текущую страницу собственных файлов.
     */
    async #loadList(): Promise<void> {
        try {
            const offset = this.#currentPage * PAGE_SIZE;
            const resp = await this.#storage.listFiles(PAGE_SIZE, offset, 'files');
            this.#totalPages = Math.max(1, Math.ceil(resp.total / PAGE_SIZE));
            this.#table?.setData(resp.files);
            this.#pagination?.update(this.#currentPage, this.#totalPages);
        } catch (error: unknown) {
            logError('DiskPage.loadList failed', error);
            this.#dropZone?.setStatus('Не удалось загрузить список файлов', 'error');
        }
    }

    /**
     * Подгружает текущую страницу файлов, расшаренных текущему пользователю.
     */
    async #loadSharedList(): Promise<void> {
        try {
            const offset = this.#sharedPage * PAGE_SIZE;
            const resp = await this.#storage.listSharedWithMe(PAGE_SIZE, offset);
            this.#sharedTotalPages = Math.max(1, Math.ceil(resp.total / PAGE_SIZE));
            this.#sharedTable?.setData(resp.files);
            this.#sharedPagination?.update(this.#sharedPage, this.#sharedTotalPages);
        } catch (error: unknown) {
            logError('DiskPage.loadSharedList failed', error);
        }
    }

    /**
     * Последовательно загружает выбранные файлы; .ipynb разруливает в импорт
     * нотебука.
     * @param files - выбранные/перетянутые файлы
     */
    async #handleUpload(files: File[]): Promise<void> {
        if (files.length === 0) return;

        const ipynb = files.find((f) => f.name.toLowerCase().endsWith('.ipynb'));
        if (ipynb) {
            await this.#handleIpynbImport(ipynb);
            return;
        }

        this.#dropZone?.setStatus(`Загрузка ${String(files.length)} ...`, 'info');
        let okCount = 0;
        const failed: { name: string; message: string }[] = [];
        for (const file of files) {
            try {
                await this.#storage.uploadFile(file);
                okCount += 1;
                await this.#usageCard?.refresh();
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'неизвестная ошибка';
                failed.push({ name: file.name, message: msg });
            }
        }
        if (failed.length === 0) {
            this.#dropZone?.setStatus(`Загружено: ${String(okCount)}`, 'ok');
        } else {
            const detail = failed.map((f) => `${f.name}: ${f.message}`).join('; ');
            this.#dropZone?.setStatus(`Загружено ${String(okCount)}, ошибки: ${detail}`, 'error');
        }
        await this.#loadList();
    }

    /**
     * Импортирует .ipynb-файл как новый ноутбук.
     * @param file - выбранный пользователем .ipynb-файл
     */
    async #handleIpynbImport(file: File): Promise<void> {
        this.#dropZone?.setStatus(`Импорт ноутбука "${file.name}"...`, 'info');
        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as { cells?: Record<string, unknown>[] };
            const blocks = ipynbToBlocks(parsed);
            const title = file.name.replace(/\.ipynb$/i, '') || 'Импортированный ноутбук';
            const notebook = await new NotebookApi().importNotebook(title, blocks);
            this.#dropZone?.setStatus(`Ноутбук "${title}" импортирован`, 'ok');
            nn(Router.getInstance()).navigate(`/notebooks/${String(notebook.id)}`);
        } catch (error: unknown) {
            logError('DiskPage.handleIpynbImport failed', error);
            const msg = error instanceof Error ? error.message : 'неизвестная ошибка';
            this.#dropZone?.setStatus(`Не удалось импортировать ноутбук: ${msg}`, 'error');
        }
    }

    /**
     * Спрашивает подтверждение и удаляет файл, после чего обновляет таблицу
     * и квоту.
     * @param file - файл к удалению
     */
    async #handleDelete(file: FileItemDTO): Promise<void> {
        // eslint-disable-next-line no-alert -- TODO(ui): replace with confirmation modal
        const ok = window.confirm(`Удалить "${file.filename}"?`);
        if (!ok) return;
        try {
            await this.#storage.deleteFile(file.id);
            await this.#usageCard?.refresh();
            await this.#loadList();
        } catch (error: unknown) {
            logError('DiskPage.handleDelete failed', error);
            this.#dropZone?.setStatus('Не удалось удалить файл', 'error');
        }
    }

    /**
     * Открывает модалку шаринга для файла. После закрытия — обновляет список
     * (на случай, если поменялась публичность или счётчики).
     * @param file - файл для шаринга
     */
    async #handleShare(file: FileItemDTO): Promise<void> {
        await FileShareModal.getInstance().open(file);
        await this.#loadList();
    }

    /**
     * Открывает модалку переименования; после сохранения — обновляет список.
     * @param file - файл к переименованию
     */
    #handleRename(file: FileItemDTO): void {
        RenameModal.getInstance().open(file, () => {
            void this.#loadList();
        });
    }
}
