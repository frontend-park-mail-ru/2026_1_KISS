import { StorageApi } from '../../shared/api/StorageApi.js';
import type { FileItemDTO } from '../../shared/api/types.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { formatBytes } from '../../shared/utils/formatBytes.js';
import { logError } from '../../shared/utils/logger.js';

const PAGE_SIZE = 20;
const CATEGORIES = ['', 'files', 'avatars', 'feedback', 'datasets'];

/**
 * Секция «Файлы» в админ-панели. Показывает все файлы пользователей с
 * фильтрами по категории и владельцу (owner_id), пагинацией и кнопкой
 * «Удалить» на каждой строке. Использует существующий админ-эндпоинт
 * /api/v1/admin/storage/files (gateway → storage gRPC AdminListFiles).
 */
export class AdminFilesSection {
    #parent: HTMLElement;
    #storage: StorageApi;
    #currentPage = 1;
    #category = '';
    #ownerId: number | null = null;
    #total = 0;
    #files: FileItemDTO[] = [];

    /**
     * Сохраняет родительский элемент и инициализирует StorageApi singleton.
     * @param parent - элемент, в который будет вставлен контент секции
     */
    public constructor(parent: HTMLElement) {
        this.#parent = parent;
        this.#storage = StorageApi.getInstance();
    }

    /**
     * Рендерит структуру секции и запускает первую загрузку. Слушатели
     * вешаются на новые элементы.
     */
    public mount(): void {
        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Файлы';
        this.#parent.appendChild(title);

        const filters = document.createElement('div');
        filters.className = 'admin-table-header';
        filters.innerHTML = `
            <select class="admin-search" data-role="category">
                <option value="">Все категории</option>
                <option value="files">files</option>
                <option value="avatars">avatars</option>
                <option value="feedback">feedback</option>
                <option value="datasets">datasets</option>
            </select>
            <input class="admin-search" type="number" min="0" placeholder="ID владельца" data-role="owner" />
            <button class="admin-action" type="button" data-role="apply">Применить</button>
            <span class="admin-count" data-role="count"></span>
        `;
        this.#parent.appendChild(filters);

        const table = document.createElement('div');
        table.className = 'admin-files-table';
        this.#parent.appendChild(table);

        const pagination = document.createElement('div');
        pagination.className = 'admin-pagination';
        this.#parent.appendChild(pagination);

        filters
            .querySelector<HTMLButtonElement>('[data-role="apply"]')
            ?.addEventListener('click', () => {
                const cat =
                    filters.querySelector<HTMLSelectElement>('[data-role="category"]')?.value ?? '';
                const ownerStr =
                    filters.querySelector<HTMLInputElement>('[data-role="owner"]')?.value ?? '';
                this.#category = CATEGORIES.includes(cat) ? cat : '';
                const ownerNum = Number.parseInt(ownerStr, 10);
                this.#ownerId = Number.isFinite(ownerNum) && ownerNum > 0 ? ownerNum : null;
                this.#currentPage = 1;
                void this.#refresh();
            });

        void this.#refresh();
    }

    /**
     * Размонтирует секцию: очищает содержимое родителя (слушатели на самих
     * элементах удалятся вместе с innerHTML).
     */
    public unmount(): void {
        this.#parent.innerHTML = '';
    }

    /**
     * Подгружает текущую страницу с учётом фильтров и перерисовывает таблицу
     * + пагинацию.
     */
    async #refresh(): Promise<void> {
        try {
            const offset = (this.#currentPage - 1) * PAGE_SIZE;
            const resp = await this.#storage.adminListFiles({
                limit: PAGE_SIZE,
                offset,
                category: this.#category === '' ? undefined : this.#category,
                ownerId: this.#ownerId ?? undefined
            });
            this.#files = resp.files;
            this.#total = resp.total;
            this.#renderTable();
            this.#renderPagination();
            this.#renderCount();
        } catch (error: unknown) {
            logError('AdminFilesSection.refresh failed', error);
        }
    }

    /**
     * Перерисовывает таблицу файлов: empty-state, заголовки, строки с кнопкой
     * удалить.
     */
    #renderTable(): void {
        const table = this.#parent.querySelector<HTMLElement>('.admin-files-table');
        if (!table) return;

        if (this.#files.length === 0) {
            table.innerHTML = '<div class="admin-empty">Файлы не найдены</div>';
            return;
        }

        const rowsHtml = this.#files
            .map((file) => {
                const safeName = escapeHtml(file.filename);
                const safeUrl = escapeHtml(file.url);
                const safeMime = escapeHtml(file.mime_type);
                const safeCat = escapeHtml(file.category);
                const date = new Date(file.created_at).toLocaleString('ru-RU');
                return `<tr data-id="${escapeHtml(file.id)}">
                    <td><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeName}</a></td>
                    <td>${String(file.owner_id)}</td>
                    <td>${safeCat}</td>
                    <td>${safeMime}</td>
                    <td>${formatBytes(file.size)}</td>
                    <td>${date}</td>
                    <td><button type="button" class="admin-action admin-action--danger" data-role="delete">Удалить</button></td>
                </tr>`;
            })
            .join('');

        table.innerHTML = `<table class="admin-data-table">
            <thead>
                <tr>
                    <th>Имя</th>
                    <th>owner_id</th>
                    <th>Категория</th>
                    <th>MIME</th>
                    <th>Размер</th>
                    <th>Дата</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>`;

        table.querySelectorAll<HTMLButtonElement>('[data-role="delete"]').forEach((btn) => {
            btn.addEventListener('click', (event: Event) => {
                const row = (event.currentTarget as HTMLElement).closest<HTMLElement>('tr');
                const id = row?.dataset.id ?? '';
                const file = this.#files.find((f) => f.id === id);
                if (file) void this.#handleDelete(file);
            });
        });
    }

    /**
     * Рендерит простую пагинацию (prev/next + номер страницы). Для админки
     * не нужен сложный paginator из shared/components.
     */
    #renderPagination(): void {
        const container = this.#parent.querySelector<HTMLElement>('.admin-pagination');
        if (!container) return;
        const totalPages = Math.max(1, Math.ceil(this.#total / PAGE_SIZE));
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = `
            <button type="button" data-role="prev" ${this.#currentPage === 1 ? 'disabled' : ''}>‹</button>
            <span>${String(this.#currentPage)} / ${String(totalPages)}</span>
            <button type="button" data-role="next" ${this.#currentPage >= totalPages ? 'disabled' : ''}>›</button>
        `;
        container
            .querySelector<HTMLButtonElement>('[data-role="prev"]')
            ?.addEventListener('click', () => {
                if (this.#currentPage > 1) {
                    this.#currentPage -= 1;
                    void this.#refresh();
                }
            });
        container
            .querySelector<HTMLButtonElement>('[data-role="next"]')
            ?.addEventListener('click', () => {
                if (this.#currentPage < totalPages) {
                    this.#currentPage += 1;
                    void this.#refresh();
                }
            });
    }

    /**
     * Обновляет счётчик «Всего N» в фильтре.
     */
    #renderCount(): void {
        const el = this.#parent.querySelector<HTMLElement>('[data-role="count"]');
        if (el) el.textContent = `Всего: ${String(this.#total)}`;
    }

    /**
     * Спрашивает подтверждение и удаляет файл админ-эндпоинтом. После
     * удачного удаления — refresh.
     * @param file - файл к удалению
     */
    async #handleDelete(file: FileItemDTO): Promise<void> {
        // eslint-disable-next-line no-alert -- admin-side confirmation; modal redesign is a separate task
        const ok = window.confirm(
            `Удалить "${file.filename}" пользователя ${String(file.owner_id)}?`
        );
        if (!ok) return;
        try {
            await this.#storage.deleteFile(file.id);
            await this.#refresh();
        } catch (error: unknown) {
            logError('AdminFilesSection.delete failed', error);
        }
    }
}
