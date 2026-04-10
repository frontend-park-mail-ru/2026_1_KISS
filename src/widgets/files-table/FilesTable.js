/**
 * @module widgets/files-table/FilesTable
 */

import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { FilesTableTemplate } from './FilesTable.template.js';
import { KebabMenu } from '../../shared/components/kebab-menu/KebabMenu.js';

/** @typedef {import('../../shared/types.js').Notebook} Notebook */

/**
 * Таблица ноутбуков с сортировкой (по названию, дате), inline-переименованием
 * и kebab-меню (переименовать, удалить) для каждой строки.
 *
 * @extends BaseComponent
 */
export class FilesTable extends BaseComponent {
    /** @type {Function} */
    #onDelete;

    /** @type {Function} */
    #onRename;

    /** @type {Function} */
    #onOpen;

    /** @type {KebabMenu[]} */
    #kebabMenus = [];

    /** @type {Notebook[]} */
    #notebooks = [];

    /** @type {string} */
    #ownerName = '';

    /** @type {?string} */
    #sortField = null;

    /** @type {string} */
    #sortDir = 'asc';

    /** @type {boolean} */
    #sortOpen = false;

    /**
     * @param {HTMLElement} parent
     * @param {Object} callbacks
     * @param {Function} callbacks.onDelete -- удаление ноутбука (id)
     * @param {Function} callbacks.onRename -- переименование (id, newTitle)
     * @param {Function} callbacks.onOpen -- открытие ноутбука (id)
     */
    constructor(parent, { onDelete, onRename, onOpen }) {
        super(null, parent);
        this.#onDelete = onDelete;
        this.#onRename = onRename;
        this.#onOpen = onOpen;
        this.#render();
    }

    /**
     * Компилирует Handlebars-шаблон FilesTable и создаёт корневой DOM-элемент таблицы.
     *
     * @private
     */
    #render() {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = FilesTableTemplate({});
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
        this.#attachSortEvents();
    }

    unmount() {
        this.#kebabMenus.forEach((m) => m.unmount());
        this.#kebabMenus = [];
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Устанавливает данные таблицы и перерисовывает строки.
     * При пустом массиве показывает empty-state.
     *
     * @param {Notebook[]} notebooks -- массив ноутбуков для отображения
     * @param {string} ownerName -- имя владельца для столбца «Владелец»
     */
    setData(notebooks, ownerName) {
        this.#notebooks = [...notebooks];
        this.#ownerName = ownerName;

        const table = this._element.querySelector('.files-table__table');
        const emptyState = this._element.querySelector('.files-table__empty-state');

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
     * Перерисовывает строки таблицы: сортирует ноутбуки, формирует ячейки с датой/владельцем и создаёт KebabMenu для каждой строки.
     *
     * @private
     */
    #renderRows() {
        this.#kebabMenus.forEach((m) => m.unmount());
        this.#kebabMenus = [];

        const sorted = [...this.#notebooks];
        if (this.#sortField === 'date') {
            sorted.sort((a, b) => {
                const diff = new Date(a.updated_at) - new Date(b.updated_at);
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

        const tbody = this._element.querySelector('.files-table__body');
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
            ownerCell.textContent = this.#ownerName;

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
                    if (e.target.closest('.files-table__kebab-cell')) return;
                    if (e.target.closest('.files-table__rename-active')) return;
                    this.#onOpen(nb.id);
                });
            }

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
        });
    }

    /**
     * Включает inline-редактирование названия в строке таблицы.
     *
     * @private
     * @param {HTMLTableRowElement} row
     * @param {HTMLElement} nameSpan -- элемент с названием
     * @param {Notebook} notebook -- данные ноутбука
     */
    #startRename(row, nameSpan, notebook) {
        const originalText = nameSpan.textContent;
        nameSpan.contentEditable = 'true';
        nameSpan.classList.add('files-table__rename-active');
        nameSpan.focus();

        const range = document.createRange();
        range.selectNodeContents(nameSpan);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        nameSpan.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });

        let saved = false;
        const save = () => {
            if (saved) return;
            saved = true;
            nameSpan.contentEditable = 'false';
            nameSpan.classList.remove('files-table__rename-active');
            const newTitle = nameSpan.textContent.trim().slice(0, 54);
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

        nameSpan.addEventListener('keydown', (e) => {
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
     * Подключает обработчики сортировки: toggle dropdown, выбор поля (title/date) и направления (asc/desc).
     *
     * @private
     */
    #attachSortEvents() {
        const trigger = this._element.querySelector('.files-table__sort-trigger');
        if (!trigger) return;

        this._addListener(trigger, 'click', (e) => {
            e.stopPropagation();
            this.#toggleSortDropdown();
        });

        this._addListener(document, 'click', () => {
            if (this.#sortOpen) this.#closeSortDropdown();
        });

        const dropdown = this._element.querySelector('.files-table__sort-dropdown');
        this._addListener(dropdown, 'click', (e) => {
            e.stopPropagation();
            const arrow = e.target.closest('.files-table__sort-arrow');
            if (!arrow) return;

            const option = arrow.closest('.files-table__sort-option');
            const field = option.dataset.sort;
            const dir = arrow.dataset.dir;

            this.#sortField = field;
            this.#sortDir = dir;
            this.#updateSortArrows();
            this.#renderRows();
            this.#closeSortDropdown();
        });
    }

    /**
     * Переключает видимость dropdown сортировки.
     *
     * @private
     */
    #toggleSortDropdown() {
        this.#sortOpen ? this.#closeSortDropdown() : this.#openSortDropdown();
    }

    /**
     * Показывает dropdown сортировки, добавляя CSS-модификатор видимости.
     *
     * @private
     */
    #openSortDropdown() {
        this.#sortOpen = true;
        this._element
            .querySelector('.files-table__sort-dropdown')
            .classList.add('files-table__sort-dropdown_visible');
    }

    /**
     * Скрывает dropdown сортировки, убирая CSS-модификатор видимости.
     *
     * @private
     */
    #closeSortDropdown() {
        this.#sortOpen = false;
        this._element
            .querySelector('.files-table__sort-dropdown')
            .classList.remove('files-table__sort-dropdown_visible');
    }

    /**
     * Обновляет визуальное состояние стрелок сортировки: снимает active со всех и ставит на текущее поле/направление.
     *
     * @private
     */
    #updateSortArrows() {
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
