import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { FilesTableTemplate } from './FilesTable.template.js';
import { KebabMenu } from '../../shared/components/kebab-menu/KebabMenu.js';
import type { Notebook } from '../../shared/types.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Notebook с дополнительным флагом _isShared: true если открыт через
 * "shared with me" (показывается owner_username вместо текущего пользователя
 * в колонке Владелец, и kebab-меню скрывается).
 */
interface FilesTableNotebook extends Notebook {
    /** true если notebook расшарен мне (а не мой собственный) */
    _isShared?: boolean;
}

/**
 * Таблица файлов в FilesPage. Поддерживает сортировку (через dropdown в
 * правой колонке заголовка) по дате/названию в asc/desc, inline-rename
 * на contenteditable span, kebab-меню действий (rename/delete) для своих
 * файлов, клик по строке → onOpen.
 *
 * Для расшаренных notebook'ов скрывает kebab (нельзя ни переименовать ни
 * удалить чужой файл) и показывает имя владельца в колонке Владелец.
 */
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

    /**
     * Создаёт таблицу с обязательным onDelete и опциональными onRename/onOpen.
     * Без onRename — kebab не покажет пункт "Переименовать"; без onOpen — клик
     * по строке ничего не делает.
     * @param parent - родительский элемент
     * @param callbacks - обработчики действий
     */
    public constructor(
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
        this.#onRename = onRename ?? null;
        this.#onOpen = onOpen ?? null;
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = FilesTableTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит таблицу и навешивает обработчики сортировки. Реальные строки
     * появляются после первого setData().
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachSortEvents();
    }

    /**
     * Размонтирует все kebab-меню (важно — иначе утечка обработчиков document)
     * и снимает с DOM.
     */
    public unmount(): void {
        this.#kebabMenus.forEach((m) => {
            m.unmount();
        });
        this.#kebabMenus = [];
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Заменяет данные таблицы и перерисовывает строки. Управляет видимостью
     * empty-state vs самой таблицы.
     * @param notebooks - массив notebook'ов для отображения
     * @param ownerName - имя текущего пользователя (для колонки Владелец у не-shared)
     */
    public setData(notebooks: FilesTableNotebook[], ownerName: string): void {
        this.#notebooks = [...notebooks];
        this.#ownerName = ownerName;

        const table = nn(this._element.querySelector<HTMLElement>('.files-table__table'));
        const emptyState = nn(
            this._element.querySelector<HTMLElement>('.files-table__empty-state')
        );

        if (notebooks.length === 0) {
            table.style.display = 'none';
            emptyState.style.display = '';
        } else {
            table.style.display = '';
            emptyState.style.display = 'none';
        }

        this.#renderRows();
    }

    /**
     * Перерисовывает все строки таблицы с учётом текущей сортировки.
     * Размонтирует все старые kebab-меню перед рендером новых (предотвращает утечки).
     */
    #renderRows(): void {
        this.#kebabMenus.forEach((m) => {
            m.unmount();
        });
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

        const tbody = nn(this._element.querySelector('.files-table__body'));
        tbody.innerHTML = '';

        // eslint-disable-next-line max-statements -- TODO(refactor): extract row-builder into private #buildRow helper; pre-existing tech debt
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
            ownerCell.textContent =
                nb._isShared === true ? (nb.owner_username ?? '\u2014') : this.#ownerName;

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
                    nn(this.#onOpen)(nb.id);
                });
            }

            if (nb._isShared !== true) {
                const actions = [];
                if (this.#onRename) {
                    actions.push({
                        name: 'rename',
                        label: 'Переименовать',
                        handler: () => {
                            this.#startRename(tr, titleSpan, nb);
                        }
                    });
                }
                actions.push({
                    name: 'delete',
                    label: 'Удалить',
                    handler: () => {
                        this.#onDelete(nb.id);
                    }
                });
                const menu = new KebabMenu(kebabCell, actions);
                menu.mount();
                this.#kebabMenus.push(menu);
            }
        });
    }

    /**
     * Запускает inline-переименование: делает name-span contenteditable, выделяет
     * текст, перехватывает paste (только plain-text), Enter (commit) и Escape (cancel).
     * При commit — обрезает до 54 символов и вызывает onRename если что-то изменилось.
     * @param row - строка таблицы (используется в области видимости callback'ов)
     * @param nameSpan - editable span с именем
     * @param notebook - данные notebook'а для onRename
     */
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
        const sel = nn(window.getSelection());
        sel.removeAllRanges();
        sel.addRange(range);

        nameSpan.addEventListener('paste', (e: ClipboardEvent) => {
            e.preventDefault();
            const text = nn(e.clipboardData).getData('text/plain');
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const r = selection.getRangeAt(0);
                r.deleteContents();
                r.insertNode(document.createTextNode(text));
                r.collapse(false);
            }
        });

        let saved = false;
        const save = (): void => {
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

        const cancel = (): void => {
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

    /**
     * Навешивает обработчики sort-trigger (toggle dropdown), document-click
     * (закрытие dropdown), click по arrow в dropdown (применить сортировку).
     */
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

        const dropdown = nn(this._element.querySelector('.files-table__sort-dropdown'));
        this._addListener(dropdown, 'click', (e: Event) => {
            e.stopPropagation();
            const arrow = (e.target as HTMLElement).closest<HTMLElement>(
                '.files-table__sort-arrow'
            );
            if (!arrow) return;

            const option = nn(arrow.closest<HTMLElement>('.files-table__sort-option'));
            const field = nn(option.dataset.sort);
            const dir = nn(arrow.dataset.dir);

            this.#sortField = field;
            this.#sortDir = dir;
            this.#updateSortArrows();
            this.#renderRows();
            this.#closeSortDropdown();
        });
    }

    /**
     * Переключает состояние dropdown'а сортировки.
     */
    #toggleSortDropdown(): void {
        if (this.#sortOpen) {
            this.#closeSortDropdown();
        } else {
            this.#openSortDropdown();
        }
    }

    /**
     * Открывает dropdown сортировки.
     */
    #openSortDropdown(): void {
        this.#sortOpen = true;
        nn(this._element.querySelector('.files-table__sort-dropdown')).classList.add(
            'files-table__sort-dropdown_visible'
        );
    }

    /**
     * Закрывает dropdown сортировки.
     */
    #closeSortDropdown(): void {
        this.#sortOpen = false;
        nn(this._element.querySelector('.files-table__sort-dropdown')).classList.remove(
            'files-table__sort-dropdown_visible'
        );
    }

    /**
     * Обновляет визуальную подсветку active-стрелки в dropdown'е сортировки
     * (показывает текущее активное направление по полю и asc/desc).
     */
    #updateSortArrows(): void {
        this._element.querySelectorAll('.files-table__sort-arrow').forEach((el) => {
            el.classList.remove('files-table__sort-arrow_active');
        });
        if ((this.#sortField ?? '') !== '') {
            const option = this._element.querySelector(
                `.files-table__sort-option[data-sort="${String(this.#sortField)}"]`
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
