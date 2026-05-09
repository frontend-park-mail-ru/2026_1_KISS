import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { FilterBarTemplate } from './FilterBar.template.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Изменения фильтров — частичное обновление (не задаёт значит "не трогать").
 * onFilterChange родителя получает только изменённые поля.
 */
interface FilterChange {
    /** Имя владельца (null — снять фильтр) */
    owner?: string | null;
    /** Дата начала диапазона ISO-формат (null — снять) */
    dateFrom?: string | null;
    /** Дата конца диапазона ISO-формат (null — снять) */
    dateTo?: string | null;
    /** Поисковая строка по названию */
    search?: string;
}

/**
 * Панель фильтров для FilesPage: поиск с debounce 200ms, dropdown "Изменено"
 * с двумя date-input (от-до), dropdown "Владелец" с динамическим списком,
 * кнопка "Очистить фильтр", кнопка "+ Создать файл".
 *
 * Открытие одного dropdown'а закрывает другой. Любой клик вне dropdown'а закрывает оба.
 * Активные фильтры подсвечивают свою кнопку (CSS-класс _active).
 */
export class FilterBar extends BaseComponent {
    #onCreate: () => void;
    #onFilterChange: (filters: FilterChange) => void;
    #dateOpen = false;
    #ownerOpen = false;
    #searchDebounce: ReturnType<typeof setTimeout> | null = null;

    /**
     * Создаёт панель с двумя callback'ами.
     * @param parent - родительский элемент
     * @param options - onCreate (нажата "+ Создать файл") и onFilterChange (изменены фильтры)
     */
    public constructor(
        parent: HTMLElement,
        {
            onCreate,
            onFilterChange
        }: {
            onCreate: () => void;
            onFilterChange: (filters: FilterChange) => void;
        }
    ) {
        super(null, parent);
        this.#onCreate = onCreate;
        this.#onFilterChange = onFilterChange;
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = FilterBarTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит панель и навешивает все обработчики.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    /**
     * Снимает с DOM. Слушатели снимаются автоматически.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Заполняет dropdown владельцев списком имён. Вызывается родителем после
     * загрузки notebook'ов (чтобы знать какие владельцы вообще доступны).
     * @param owners - имена владельцев для dropdown'а
     */
    public setOwners(owners: string[]): void {
        const dropdown = nn(this._element.querySelector('.filter-bar__owner-dropdown'));
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
     * Навешивает обработчики: создать-кнопка, поиск с debounce, открытие/закрытие
     * date/owner dropdown'ов, change для date-input'ов, click по owner-item для
     * выбора фильтра, очистка, document-click для закрытия dropdown'ов.
     */
    #attachEvents(): void {
        const createBtn = nn(this._element.querySelector('.filter-bar__create-btn'));
        this._addListener(createBtn, 'click', () => {
            this.#onCreate();
        });

        const searchInput = nn(this._element.querySelector('.filter-bar__search-input'));
        this._addListener(searchInput, 'input', (e: Event) => {
            clearTimeout(nn(this.#searchDebounce));
            const value = (e.target as HTMLInputElement).value;
            this.#searchDebounce = setTimeout(() => {
                this.#onFilterChange({ search: value });
            }, 200);
        });

        const dateBtn = nn(this._element.querySelector('.filter-bar__date-btn'));
        this._addListener(dateBtn, 'click', (e: Event) => {
            e.stopPropagation();
            this.#closeOwnerDropdown();
            this.#toggleDateDropdown();
        });

        const dateFrom = nn(this._element.querySelector('.filter-bar__date-from'));
        const dateTo = nn(this._element.querySelector('.filter-bar__date-to'));
        this._addListener(dateFrom, 'change', () => {
            this.#onDateChange();
        });
        this._addListener(dateTo, 'change', () => {
            this.#onDateChange();
        });

        const dateDropdown = nn(this._element.querySelector('.filter-bar__date-dropdown'));
        this._addListener(dateDropdown, 'click', (e: Event) => {
            e.stopPropagation();
        });

        const ownerBtn = nn(this._element.querySelector('.filter-bar__owner-btn'));
        this._addListener(ownerBtn, 'click', (e: Event) => {
            e.stopPropagation();
            this.#closeDateDropdown();
            this.#toggleOwnerDropdown();
        });

        const ownerDropdown = nn(this._element.querySelector('.filter-bar__owner-dropdown'));
        this._addListener(ownerDropdown, 'click', (e: Event) => {
            e.stopPropagation();
            const item = (e.target as HTMLElement).closest<HTMLElement>('[data-owner]');
            if (item?.dataset.owner === undefined) return;
            this.#selectOwner(item.dataset.owner);
            this.#closeOwnerDropdown();
        });

        const clearBtn = nn(this._element.querySelector('.filter-bar__clear-btn'));
        this._addListener(clearBtn, 'click', () => {
            this.#clearFilters();
        });

        this._addListener(document, 'click', () => {
            if (this.#dateOpen) this.#closeDateDropdown();
            if (this.#ownerOpen) this.#closeOwnerDropdown();
        });
    }

    /**
     * Переключает состояние dropdown'а дат.
     */
    #toggleDateDropdown(): void {
        if (this.#dateOpen) {
            this.#closeDateDropdown();
        } else {
            this.#openDateDropdown();
        }
    }

    /**
     * Открывает dropdown дат (CSS-класс).
     */
    #openDateDropdown(): void {
        this.#dateOpen = true;
        nn(this._element.querySelector('.filter-bar__date-dropdown')).classList.add(
            'filter-bar__date-dropdown_visible'
        );
    }

    /**
     * Закрывает dropdown дат.
     */
    #closeDateDropdown(): void {
        this.#dateOpen = false;
        nn(this._element.querySelector('.filter-bar__date-dropdown')).classList.remove(
            'filter-bar__date-dropdown_visible'
        );
    }

    /**
     * Переключает состояние dropdown'а владельцев.
     */
    #toggleOwnerDropdown(): void {
        if (this.#ownerOpen) {
            this.#closeOwnerDropdown();
        } else {
            this.#openOwnerDropdown();
        }
    }

    /**
     * Открывает dropdown владельцев.
     */
    #openOwnerDropdown(): void {
        this.#ownerOpen = true;
        nn(this._element.querySelector('.filter-bar__owner-dropdown')).classList.add(
            'filter-bar__owner-dropdown_visible'
        );
    }

    /**
     * Закрывает dropdown владельцев.
     */
    #closeOwnerDropdown(): void {
        this.#ownerOpen = false;
        nn(this._element.querySelector('.filter-bar__owner-dropdown')).classList.remove(
            'filter-bar__owner-dropdown_visible'
        );
    }

    /**
     * Применяет выбранного владельца как фильтр: меняет текст кнопки,
     * подсвечивает её и уведомляет родителя через onFilterChange.
     * @param owner - имя владельца
     */
    #selectOwner(owner: string): void {
        const btn = nn(this._element.querySelector('.filter-bar__owner-btn'));
        btn.textContent = `${owner} - Владелец`;
        btn.classList.add('filter-bar__dropdown-btn_active');
        this.#onFilterChange({ owner });
    }

    /**
     * Применяет выбранный диапазон дат: формирует подпись на кнопке ("с DD.MM.YYYY
     * по DD.MM.YYYY"), подсвечивает её, уведомляет родителя.
     */
    #onDateChange(): void {
        const dateFrom =
            nn(this._element.querySelector<HTMLInputElement>('.filter-bar__date-from')).value ||
            null;
        const dateTo =
            nn(this._element.querySelector<HTMLInputElement>('.filter-bar__date-to')).value || null;
        const dateBtn = nn(this._element.querySelector('.filter-bar__date-btn'));

        if (dateFrom !== null || dateTo !== null) {
            dateBtn.classList.add('filter-bar__dropdown-btn_active');
            const parts: string[] = [];
            if (dateFrom !== null) parts.push(`с ${this.#formatDate(dateFrom)}`);
            if (dateTo !== null) parts.push(`по ${this.#formatDate(dateTo)}`);
            dateBtn.textContent = parts.join(' ');
        } else {
            dateBtn.classList.remove('filter-bar__dropdown-btn_active');
            dateBtn.textContent = 'Изменено';
        }

        this.#onFilterChange({ dateFrom, dateTo });
    }

    /**
     * Форматирует ISO-дату YYYY-MM-DD в DD.MM.YYYY для UI.
     * @param isoDate - дата в ISO-формате
     * @returns дата в локальном формате
     */
    #formatDate(isoDate: string): string {
        const [y, m, d] = isoDate.split('-');
        return `${d}.${m}.${y}`;
    }

    /**
     * Сбрасывает все фильтры: возвращает дефолтные подписи кнопок, очищает
     * date-input'ы и search-input, отменяет ожидающий debounce, уведомляет
     * родителя что все фильтры сняты.
     */
    #clearFilters(): void {
        const ownerBtn = nn(this._element.querySelector('.filter-bar__owner-btn'));
        ownerBtn.textContent = 'Владелец';
        ownerBtn.classList.remove('filter-bar__dropdown-btn_active');

        const dateBtn = nn(this._element.querySelector('.filter-bar__date-btn'));
        dateBtn.classList.remove('filter-bar__dropdown-btn_active');
        dateBtn.textContent = 'Изменено';

        nn(this._element.querySelector('.filter-bar__date-from')).value = '';
        nn(this._element.querySelector('.filter-bar__date-to')).value = '';
        nn(this._element.querySelector('.filter-bar__search-input')).value = '';

        clearTimeout(nn(this.#searchDebounce));
        this.#onFilterChange({ owner: null, dateFrom: null, dateTo: null, search: '' });
    }
}
