/**
 * @module widgets/filter-bar/FilterBar
 */

import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { FilterBarTemplate } from './FilterBar.template.js';

/** @typedef {import('../../shared/types.js').FilterChangeCallback} FilterChangeCallback */

/**
 * Панель фильтров списка ноутбуков: кнопка создания, фильтр по дате,
 * фильтр по владельцу, кнопка сброса.
 *
 * @extends BaseComponent
 */
export class FilterBar extends BaseComponent {
    /** @type {Function} */
    #onCreate;

    /** @type {FilterChangeCallback} */
    #onFilterChange;

    /** @type {boolean} */
    #dateOpen = false;

    /** @type {boolean} */
    #ownerOpen = false;
    #searchDebounce = null;

    /**
     * @param {HTMLElement} parent
     * @param {Object} callbacks
     * @param {Function} callbacks.onCreate -- создание нового ноутбука
     * @param {FilterChangeCallback} callbacks.onFilterChange -- изменение фильтров
     */
    constructor(parent, { onCreate, onFilterChange }) {
        super(null, parent);
        this.#onCreate = onCreate;
        this.#onFilterChange = onFilterChange;
        this.#render();
    }

    /**
     * Компилирует Handlebars-шаблон FilterBar и создаёт корневой DOM-элемент компонента.
     *
     * @private
     */
    #render() {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = FilterBarTemplate({});
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    unmount() {
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Заполняет dropdown владельцев кнопками.
     *
     * @param {string[]} owners -- список имён владельцев
     */
    setOwners(owners) {
        const dropdown = this._element.querySelector('.filter-bar__owner-dropdown');
        dropdown.innerHTML = '';
        owners.forEach((name) => {
            const btn = document.createElement('button');
            btn.className = 'filter-bar__owner-item';
            btn.textContent = name;
            btn.dataset.owner = name;
            dropdown.appendChild(btn);
        });
    }

    /**
     * Подключает обработчики: создание ноутбука, toggle dropdown-ов фильтров, выбор владельца, изменение дат и сброс.
     *
     * @private
     */
    #attachEvents() {
        const createBtn = this._element.querySelector('.filter-bar__create-btn');
        this._addListener(createBtn, 'click', () => {
            this.#onCreate();
        });

        const searchInput = this._element.querySelector('.filter-bar__search-input');
        this._addListener(searchInput, 'input', (e) => {
            clearTimeout(this.#searchDebounce);
            const value = e.target.value;
            this.#searchDebounce = setTimeout(() => {
                if (this.#onFilterChange) this.#onFilterChange({ search: value });
            }, 200);
        });

        const dateBtn = this._element.querySelector('.filter-bar__date-btn');
        this._addListener(dateBtn, 'click', (e) => {
            e.stopPropagation();
            this.#closeOwnerDropdown();
            this.#toggleDateDropdown();
        });

        const dateFrom = this._element.querySelector('.filter-bar__date-from');
        const dateTo = this._element.querySelector('.filter-bar__date-to');
        this._addListener(dateFrom, 'change', () => {
            this.#onDateChange();
        });
        this._addListener(dateTo, 'change', () => {
            this.#onDateChange();
        });

        const dateDropdown = this._element.querySelector('.filter-bar__date-dropdown');
        this._addListener(dateDropdown, 'click', (e) => {
            e.stopPropagation();
        });

        const ownerBtn = this._element.querySelector('.filter-bar__owner-btn');
        this._addListener(ownerBtn, 'click', (e) => {
            e.stopPropagation();
            this.#closeDateDropdown();
            this.#toggleOwnerDropdown();
        });

        const ownerDropdown = this._element.querySelector('.filter-bar__owner-dropdown');
        this._addListener(ownerDropdown, 'click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('[data-owner]');
            if (!item) return;
            this.#selectOwner(item.dataset.owner);
            this.#closeOwnerDropdown();
        });

        const clearBtn = this._element.querySelector('.filter-bar__clear-btn');
        this._addListener(clearBtn, 'click', () => {
            this.#clearFilters();
        });

        this._addListener(document, 'click', () => {
            if (this.#dateOpen) this.#closeDateDropdown();
            if (this.#ownerOpen) this.#closeOwnerDropdown();
        });
    }

    /**
     * Переключает видимость dropdown фильтра по дате.
     *
     * @private
     */
    #toggleDateDropdown() {
        this.#dateOpen ? this.#closeDateDropdown() : this.#openDateDropdown();
    }

    /**
     * Показывает dropdown фильтра по дате, добавляя CSS-модификатор видимости.
     *
     * @private
     */
    #openDateDropdown() {
        this.#dateOpen = true;
        this._element
            .querySelector('.filter-bar__date-dropdown')
            .classList.add('filter-bar__date-dropdown_visible');
    }

    /**
     * Скрывает dropdown фильтра по дате, убирая CSS-модификатор видимости.
     *
     * @private
     */
    #closeDateDropdown() {
        this.#dateOpen = false;
        this._element
            .querySelector('.filter-bar__date-dropdown')
            .classList.remove('filter-bar__date-dropdown_visible');
    }

    /**
     * Переключает видимость dropdown фильтра по владельцу.
     *
     * @private
     */
    #toggleOwnerDropdown() {
        this.#ownerOpen ? this.#closeOwnerDropdown() : this.#openOwnerDropdown();
    }

    /**
     * Показывает dropdown фильтра по владельцу, добавляя CSS-модификатор видимости.
     *
     * @private
     */
    #openOwnerDropdown() {
        this.#ownerOpen = true;
        this._element
            .querySelector('.filter-bar__owner-dropdown')
            .classList.add('filter-bar__owner-dropdown_visible');
    }

    /**
     * Скрывает dropdown фильтра по владельцу, убирая CSS-модификатор видимости.
     *
     * @private
     */
    #closeOwnerDropdown() {
        this.#ownerOpen = false;
        this._element
            .querySelector('.filter-bar__owner-dropdown')
            .classList.remove('filter-bar__owner-dropdown_visible');
    }

    /**
     * @private
     * @param {string} owner -- выбранный владелец
     */
    #selectOwner(owner) {
        const btn = this._element.querySelector('.filter-bar__owner-btn');
        btn.textContent = `${owner} - Владелец`;
        btn.classList.add('filter-bar__dropdown-btn_active');
        if (this.#onFilterChange) {
            this.#onFilterChange({ owner });
        }
    }

    /**
     * Обрабатывает изменение полей "дата с"/"дата по": обновляет текст кнопки и вызывает onFilterChange.
     *
     * @private
     */
    #onDateChange() {
        const dateFrom = this._element.querySelector('.filter-bar__date-from').value || null;
        const dateTo = this._element.querySelector('.filter-bar__date-to').value || null;
        const dateBtn = this._element.querySelector('.filter-bar__date-btn');

        if (dateFrom || dateTo) {
            dateBtn.classList.add('filter-bar__dropdown-btn_active');
            const parts = [];
            if (dateFrom) parts.push(`с ${this.#formatDate(dateFrom)}`);
            if (dateTo) parts.push(`по ${this.#formatDate(dateTo)}`);
            dateBtn.textContent = parts.join(' ');
        } else {
            dateBtn.classList.remove('filter-bar__dropdown-btn_active');
            dateBtn.textContent = 'Изменено';
        }

        if (this.#onFilterChange) {
            this.#onFilterChange({ dateFrom, dateTo });
        }
    }

    /**
     * Преобразует ISO-дату (YYYY-MM-DD) в формат DD.MM.YYYY.
     *
     * @private
     * @param {string} isoDate -- дата в формате ISO
     * @returns {string} дата в формате DD.MM.YYYY
     */
    #formatDate(isoDate) {
        const [y, m, d] = isoDate.split('-');
        return `${d}.${m}.${y}`;
    }

    /**
     * Сбрасывает все фильтры (владелец + даты) в исходное состояние и уведомляет через onFilterChange.
     *
     * @private
     */
    #clearFilters() {
        const ownerBtn = this._element.querySelector('.filter-bar__owner-btn');
        ownerBtn.textContent = 'Владелец';
        ownerBtn.classList.remove('filter-bar__dropdown-btn_active');

        const dateBtn = this._element.querySelector('.filter-bar__date-btn');
        dateBtn.classList.remove('filter-bar__dropdown-btn_active');
        dateBtn.textContent = 'Изменено';

        this._element.querySelector('.filter-bar__date-from').value = '';
        this._element.querySelector('.filter-bar__date-to').value = '';
        this._element.querySelector('.filter-bar__search-input').value = '';

        clearTimeout(this.#searchDebounce);
        if (this.#onFilterChange) {
            this.#onFilterChange({ owner: null, dateFrom: null, dateTo: null, search: '' });
        }
    }
}
