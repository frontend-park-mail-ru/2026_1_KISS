import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { FileDropZone } from '../../widgets/file-drop-zone/FileDropZone.js';
import { DiskTable } from '../../widgets/disk-table/DiskTable.js';
import { DiskUsageCard } from '../../widgets/disk-usage-card/DiskUsageCard.js';
import { FileShareModal } from '../../widgets/file-share-modal/FileShareModal.js';
import { RenameModal } from '../../widgets/rename-modal/RenameModal.js';
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

const MAX_FILES_PER_SOURCE = 100;

/**
 * Страница «Мой диск» (`/disk`): объединённая таблица собственных файлов
 * и файлов, расшаренных текущему пользователю, отсортированная по дате.
 * Доступ через `your_permission`: 'owner' для своих, 'view' / 'download'
 * для расшаренных. Действия — через контекстное меню в таблице.
 */
export class DiskPage {
    #root: HTMLElement;
    #httpClient: HttpClient;
    #storage: StorageApi;
    #user: UserDTO | null = null;
    #header: GreenHeader | null = null;
    #usageCard: DiskUsageCard | null = null;
    #dropZone: FileDropZone | null = null;
    #table: DiskTable | null = null;
    #feedbackModal: FeedbackModal | null = null;

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
     * Загружает текущего пользователя, монтирует виджеты и подгружает
     * объединённый список файлов. При 401 — редирект на /sign.
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

        this.#user = user;
        this.#root.innerHTML = DiskPageTemplate();
        this.#mountWidgets(user);
        await this.#loadAll();
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

        this.#header = new GreenHeader(headerMount, this.#buildHeaderConfig(user));
        this.#header.render();

        this.#usageCard = new DiskUsageCard(usageMount);
        this.#usageCard.mount();

        this.#dropZone = new FileDropZone(dropMount, {
            onFiles: (files): Promise<void> => this.#handleUpload(files)
        });
        this.#dropZone.mount();

        this.#table = new DiskTable(tableMount, {
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
    }

    /**
     * Собирает конфиг для GreenHeader.
     * @param user - данные пользователя
     * @returns объект конфигурации
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
        this.#header = null;
        this.#usageCard = null;
        this.#dropZone = null;
        this.#table = null;
    }

    /**
     * Параллельно подгружает собственные и расшаренные файлы, объединяет
     * в один список, помечает «свои» признаком your_permission='owner' и
     * сортирует по дате. Ошибки одной из сторон отображает через статус
     * drop-zone, но не блокирует отображение другой.
     */
    async #loadAll(): Promise<void> {
        const ownerEmail = this.#user?.email ?? '';
        const [ownResult, sharedResult] = await Promise.allSettled([
            this.#storage.listFiles(MAX_FILES_PER_SOURCE, 0, 'files'),
            this.#storage.listSharedWithMe(MAX_FILES_PER_SOURCE, 0)
        ]);
        const files: FileItemDTO[] = [];
        if (ownResult.status === 'fulfilled') {
            for (const f of ownResult.value.files) {
                files.push({
                    ...f,
                    your_permission: 'owner',
                    owner_email:
                        f.owner_email !== undefined && f.owner_email !== ''
                            ? f.owner_email
                            : ownerEmail
                });
            }
        } else {
            logError('DiskPage.loadAll: own files failed', ownResult.reason);
            this.#dropZone?.setStatus('Не удалось загрузить список файлов', 'error');
        }
        if (sharedResult.status === 'fulfilled') {
            for (const f of sharedResult.value.files) {
                files.push(f);
            }
        } else {
            logError('DiskPage.loadAll: shared files failed', sharedResult.reason);
        }
        files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        this.#table?.setData(files);
    }

    /**
     * Последовательно загружает выбранные файлы; .ipynb уходят в импорт ноутбука.
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
        await this.#loadAll();
    }

    /**
     * Импортирует .ipynb-файл как новый ноутбук.
     * @param file - выбранный .ipynb
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
            await this.#loadAll();
        } catch (error: unknown) {
            logError('DiskPage.handleDelete failed', error);
            this.#dropZone?.setStatus('Не удалось удалить файл', 'error');
        }
    }

    /**
     * Открывает модалку шаринга. После закрытия обновляет список.
     * @param file - файл для шаринга
     */
    async #handleShare(file: FileItemDTO): Promise<void> {
        await FileShareModal.getInstance().open(file);
        await this.#loadAll();
    }

    /**
     * Открывает модалку переименования. После сохранения обновляет список.
     * @param file - файл к переименованию
     */
    #handleRename(file: FileItemDTO): void {
        RenameModal.getInstance().open(file, () => {
            void this.#loadAll();
        });
    }
}
