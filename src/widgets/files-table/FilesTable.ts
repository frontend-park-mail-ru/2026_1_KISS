import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { FilesTableTemplate } from './FilesTable.template.js';
import { KebabMenu } from '../../shared/components/kebab-menu/KebabMenu.js';
import type { Notebook } from '../../shared/types.js';

interface FilesTableNotebook extends Notebook {
    _isShared?: boolean;
}

export class FilesTable extends BaseComponent {
    #onDelete: (id: string) => void;
    #onRename: ((id: string, newTitle: string) => void) | null;
    #onOpen: ((id: string) => void) | null;
    #kebabMenus: KebabMenu[] = [];
    #notebooks: FilesTableNotebook[] = [];
    #ownerName = '';
    #sortField: string | null = null;
    #sortDir = 'asc';
    #sortOpen = false;

    constructor(
        parent: HTMLElement,
        {
            onDelete,
            onRename,
            onOpen
        }: {
            onDelete: (id: string) => void;
            onRename?: (id: string, newTitle: string) => void;
            onOpen?: (id: string) => void;
        }
    ) {
        super(null, parent);
        this.#onDelete = onDelete;
        this.#onRename = onRename || null;
        this.#onOpen = onOpen || null;
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = FilesTableTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachSortEvents();
    }

    unmount(): void {
        this.#kebabMenus.forEach((m) => m.unmount());
        this.#kebabMenus = [];
        if (!this._isMounted) return;
        super.unmount();
    }

    setData(notebooks: FilesTableNotebook[], ownerName: string): void {
        this.#notebooks = [...notebooks];
        this.#ownerName = ownerName;

        const table = this._element.querySelector('.files-table__table') as HTMLElement;
        const emptyState = this._element.querySelector('.files-table__empty-state') as HTMLElement;

        if (notebooks.length === 0) {
            table.style.display = 'none';
            emptyState.style.display = '';
        } else {
            table.style.display = '';
            emptyState.style.display = 'none';
        }

        this.#renderRows();
    }

    #renderRows(): void {
        this.#kebabMenus.forEach((m) => m.unmount());
        this.#kebabMenus = [];

        const sorted = [...this.#notebooks];
        if (this.#sortField === 'date') {
            sorted.sort((a, b) => {
                const diff = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
                return this.#sortDir === 'asc' ? diff : -diff;
            });
        } else if (this.#sortField === 'title') {
            sorted.sort((a, b) => {
                const diff = (a.title || '').localeCompare(b.title || '', 'ru');
                return this.#sortDir === 'asc' ? diff : -diff;
            });
        }

        const formatter = new Intl.DateTimeFormat('ru', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const tbody = this._element.querySelector('.files-table__body') as HTMLElement;
        tbody.innerHTML = '';

        sorted.forEach((nb) => {
            const tr = document.createElement('tr');
            tr.className = 'files-table__row';

            const nameCell = document.createElement('td');
            nameCell.className = 'files-table__cell files-table__cell_name';
            const icon = document.createElement('span');
            icon.className = 'files-table__icon';
            icon.textContent = 'K';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'files-table__title';
            titleSpan.textContent = nb.title || 'Untitled';
            nameCell.appendChild(icon);
            nameCell.appendChild(titleSpan);

            const dateCell = document.createElement('td');
            dateCell.className = 'files-table__cell';
            dateCell.textContent = formatter.format(new Date(nb.updated_at));

            const ownerCell = document.createElement('td');
            ownerCell.className = 'files-table__cell';
            ownerCell.textContent = nb._isShared ? nb.owner_username || '\u2014' : this.#ownerName;

            const kebabCell = document.createElement('td');
            kebabCell.className = 'files-table__cell files-table__kebab-cell';

            tr.appendChild(nameCell);
            tr.appendChild(dateCell);
            tr.appendChild(ownerCell);
            tr.appendChild(kebabCell);
            tbody.appendChild(tr);

            if (this.#onOpen) {
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', (e) => {
                    if ((e.target as HTMLElement).closest('.files-table__kebab-cell')) return;
                    if ((e.target as HTMLElement).closest('.files-table__rename-active')) return;
                    this.#onOpen!(nb.id);
                });
            }

            if (!nb._isShared) {
                const actions = [];
                if (this.#onRename) {
                    actions.push({
                        name: 'rename',
                        label: 'Переименовать',
                        handler: () => this.#startRename(tr, titleSpan, nb)
                    });
                }
                actions.push({
                    name: 'delete',
                    label: 'Удалить',
                    handler: () => this.#onDelete(nb.id)
                });
                const menu = new KebabMenu(kebabCell, actions);
                menu.mount();
                this.#kebabMenus.push(menu);
            }
        });
    }

    #startRename(
        row: HTMLTableRowElement,
        nameSpan: HTMLElement,
        notebook: FilesTableNotebook
    ): void {
        const originalText = nameSpan.textContent || '';
        nameSpan.contentEditable = 'true';
        nameSpan.classList.add('files-table__rename-active');
        nameSpan.focus();

        const range = document.createRange();
        range.selectNodeContents(nameSpan);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);

        nameSpan.addEventListener('paste', (e: ClipboardEvent) => {
            e.preventDefault();
            const text = e.clipboardData!.getData('text/plain');
            document.execCommand('insertText', false, text);
        });

        let saved = false;
        const save = () => {
            if (saved) return;
            saved = true;
            nameSpan.contentEditable = 'false';
            nameSpan.classList.remove('files-table__rename-active');
            const newTitle = (nameSpan.textContent || '').trim().slice(0, 54);
            if (!newTitle) {
                nameSpan.textContent = originalText;
            } else if (newTitle !== originalText && this.#onRename) {
                this.#onRename(notebook.id, newTitle);
            }
        };

        const cancel = () => {
            if (saved) return;
            saved = true;
            nameSpan.contentEditable = 'false';
            nameSpan.classList.remove('files-table__rename-active');
            nameSpan.textContent = originalText;
        };

        nameSpan.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameSpan.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
            }
        });
        nameSpan.addEventListener('blur', save);
    }

    #attachSortEvents(): void {
        const trigger = this._element.querySelector('.files-table__sort-trigger');
        if (!trigger) return;

        this._addListener(trigger, 'click', (e: Event) => {
            e.stopPropagation();
            this.#toggleSortDropdown();
        });

        this._addListener(document, 'click', () => {
            if (this.#sortOpen) this.#closeSortDropdown();
        });

        const dropdown = this._element.querySelector('.files-table__sort-dropdown') as HTMLElement;
        this._addListener(dropdown, 'click', (e: Event) => {
            e.stopPropagation();
            const arrow = (e.target as HTMLElement).closest(
                '.files-table__sort-arrow'
            ) as HTMLElement | null;
            if (!arrow) return;

            const option = arrow.closest('.files-table__sort-option') as HTMLElement;
            const field = option.dataset.sort!;
            const dir = arrow.dataset.dir!;

            this.#sortField = field;
            this.#sortDir = dir;
            this.#updateSortArrows();
            this.#renderRows();
            this.#closeSortDropdown();
        });
    }

    #toggleSortDropdown(): void {
        if (this.#sortOpen) {
            this.#closeSortDropdown();
        } else {
            this.#openSortDropdown();
        }
    }

    #openSortDropdown(): void {
        this.#sortOpen = true;
        this._element
            .querySelector('.files-table__sort-dropdown')!
            .classList.add('files-table__sort-dropdown_visible');
    }

    #closeSortDropdown(): void {
        this.#sortOpen = false;
        this._element
            .querySelector('.files-table__sort-dropdown')!
            .classList.remove('files-table__sort-dropdown_visible');
    }

    #updateSortArrows(): void {
        this._element.querySelectorAll('.files-table__sort-arrow').forEach((el) => {
            el.classList.remove('files-table__sort-arrow_active');
        });
        if (this.#sortField) {
            const option = this._element.querySelector(
                `.files-table__sort-option[data-sort="${this.#sortField}"]`
            );
            if (option) {
                const arrow = option.querySelector(
                    `.files-table__sort-arrow[data-dir="${this.#sortDir}"]`
                );
                if (arrow) arrow.classList.add('files-table__sort-arrow_active');
            }
        }
    }
}
