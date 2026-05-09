import { AdminApi } from '../../shared/api/AdminApi.js';
import { ContextMenu } from '../../shared/components/context-menu/ContextMenu.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { logError } from '../../shared/utils/logger.js';
import { plural, renderPagination } from '../admin-shared/admin-helpers.js';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Виджет секции "Блокноты" в админке. Самодостаточен: владеет AdminApi,
 * собственным ContextMenu, состоянием пагинации и поиска. Рендерит таблицу
 * блокнотов с колонками ID/название/owner_id/доступ/дата создания и
 * контекстным меню удаления (с подтверждением).
 *
 * Заменяет ~140 строк методов в AdminPage (#initNotebooksSection +
 * #refreshNotebooksTable).
 */
export class AdminNotebooksSection {
    #parent: HTMLElement;
    #api: AdminApi;
    #contextMenu: ContextMenu;
    #currentPage = 1;
    #currentSearch = '';
    #searchTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Сохраняет родительский элемент и инициализирует API/ContextMenu.
     * @param parent - элемент, в который будет вставлен контент секции
     */
    public constructor(parent: HTMLElement) {
        this.#parent = parent;
        this.#api = new AdminApi();
        this.#contextMenu = new ContextMenu();
    }

    /**
     * Рендерит структуру секции (заголовок + поиск + контейнер таблицы)
     * и запускает первую загрузку данных.
     */
    public mount(): void {
        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Блокноты';
        this.#parent.appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по названию...';
        searchInput.addEventListener('input', () => {
            if (this.#searchTimeout !== null) clearTimeout(this.#searchTimeout);
            this.#searchTimeout = setTimeout(() => {
                this.#currentSearch = searchInput.value;
                this.#currentPage = 1;
                void this.#refreshTable();
            }, SEARCH_DEBOUNCE_MS);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'nb-count';
        header.appendChild(countEl);
        this.#parent.appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        this.#parent.appendChild(tableContainer);

        void this.#refreshTable();
    }

    /**
     * Очищает родительский элемент и таймер поиска.
     */
    public unmount(): void {
        if (this.#searchTimeout !== null) clearTimeout(this.#searchTimeout);
        this.#parent.innerHTML = '';
    }

    /**
     * Перезагружает таблицу блокнотов с учётом текущей страницы и поиска.
     */
    async #refreshTable(): Promise<void> {
        const tableContainer = this.#parent.querySelector('.admin-table-container');
        const countEl = this.#parent.querySelector('[data-role="nb-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const offset = (this.#currentPage - 1) * PAGE_SIZE;

        try {
            const data = await this.#api.getNotebooks(PAGE_SIZE, offset, this.#currentSearch);
            const notebooks = data.notebooks as unknown as Record<string, unknown>[];
            const total = data.total;
            if (countEl) {
                countEl.textContent = `${String(total)} блокнот${plural(total, '', 'а', 'ов')}`;
            }

            if (notebooks.length === 0) {
                tableContainer.innerHTML = '<div class="admin-empty">Блокноты не найдены</div>';
                return;
            }

            const table = this.#buildTable(notebooks);
            tableContainer.appendChild(table);

            const totalPages = Math.ceil(total / PAGE_SIZE);
            if (totalPages > 1) {
                renderPagination(
                    tableContainer as HTMLElement,
                    this.#currentPage,
                    totalPages,
                    (p: number) => {
                        this.#currentPage = p;
                        void this.#refreshTable();
                    }
                );
            }
        } catch (e: unknown) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${escapeHtml((e as Error).message)}</div>`;
        }
    }

    /**
     * Строит HTML-таблицу блокнотов. Не делает сетевых запросов.
     * @param notebooks - массив блокнотов из API
     * @returns готовая таблица для вставки в DOM
     */
    #buildTable(notebooks: Record<string, unknown>[]): HTMLTableElement {
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
            const tr = this.#buildRow(nb);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    /**
     * Строит одну строку таблицы блокнотов с context-menu на правый клик.
     * @param nb - данные блокнота
     * @returns готовая строка `<tr>`
     */
    #buildRow(nb: Record<string, unknown>): HTMLTableRowElement {
        const tr = document.createElement('tr');
        const accessBadge =
            nb.is_public !== undefined && nb.is_public !== null
                ? '<span class="admin-badge admin-badge--active">public</span>'
                : '<span class="admin-badge">private</span>';

        tr.innerHTML = `
            <td class="admin-table__muted">${String(nb.id)}</td>
            <td class="admin-table__cell-truncate" title="${escapeHtml(nb.title)}"><strong>${escapeHtml(nb.title)}</strong></td>
            <td class="admin-table__muted">${String(nb.owner_id)}</td>
            <td>${accessBadge}</td>
            <td class="admin-table__muted">${new Date(nb.created_at as string).toLocaleDateString('ru-RU')}</td>`;

        tr.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.#contextMenu.show(e.clientX, e.clientY, [
                {
                    label: 'Удалить',
                    danger: true,
                    handler: (): void => {
                        void this.#confirmAndDelete(nb);
                    }
                }
            ]);
        });
        return tr;
    }

    /**
     * Показывает confirm и при подтверждении удаляет блокнот через AdminApi,
     * после чего перезагружает таблицу. Ошибки показываются alert'ом
     * (admin-only — это допустимо, см. комментарий в коде).
     * @param nb - данные удаляемого блокнота
     */
    async #confirmAndDelete(nb: Record<string, unknown>): Promise<void> {
        // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
        if (!confirm(`Удалить блокнот "${String(nb.title)}"?`)) return;
        try {
            await this.#api.deleteNotebook(nb.id as string | number);
            void this.#refreshTable();
        } catch (err: unknown) {
            logError('Failed to delete notebook:', err);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((err as Error).message);
        }
    }
}
