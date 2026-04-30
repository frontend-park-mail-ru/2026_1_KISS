import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { FilterBarTemplate } from './FilterBar.template.js';

interface FilterChange {
    owner?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    search?: string;
}

export class FilterBar extends BaseComponent {
    #onCreate: () => void;
    #onFilterChange: (filters: FilterChange) => void;
    #dateOpen = false;
    #ownerOpen = false;
    #searchDebounce: ReturnType<typeof setTimeout> | null = null;

    constructor(
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

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = FilterBarTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    setOwners(owners: string[]): void {
        const dropdown = this._element.querySelector('.filter-bar__owner-dropdown') as HTMLElement;
        dropdown.innerHTML = '';
        owners.forEach((name) => {
            const btn = document.createElement('button');
            btn.className = 'filter-bar__owner-item';
            btn.textContent = name;
            btn.dataset.owner = name;
            dropdown.appendChild(btn);
        });
    }

    #attachEvents(): void {
        const createBtn = this._element.querySelector('.filter-bar__create-btn') as HTMLElement;
        this._addListener(createBtn, 'click', () => {
            this.#onCreate();
        });

        const searchInput = this._element.querySelector(
            '.filter-bar__search-input'
        ) as HTMLInputElement;
        this._addListener(searchInput, 'input', (e: Event) => {
            clearTimeout(this.#searchDebounce!);
            const value = (e.target as HTMLInputElement).value;
            this.#searchDebounce = setTimeout(() => {
                this.#onFilterChange({ search: value });
            }, 200);
        });

        const dateBtn = this._element.querySelector('.filter-bar__date-btn') as HTMLElement;
        this._addListener(dateBtn, 'click', (e: Event) => {
            e.stopPropagation();
            this.#closeOwnerDropdown();
            this.#toggleDateDropdown();
        });

        const dateFrom = this._element.querySelector('.filter-bar__date-from') as HTMLInputElement;
        const dateTo = this._element.querySelector('.filter-bar__date-to') as HTMLInputElement;
        this._addListener(dateFrom, 'change', () => {
            this.#onDateChange();
        });
        this._addListener(dateTo, 'change', () => {
            this.#onDateChange();
        });

        const dateDropdown = this._element.querySelector(
            '.filter-bar__date-dropdown'
        ) as HTMLElement;
        this._addListener(dateDropdown, 'click', (e: Event) => {
            e.stopPropagation();
        });

        const ownerBtn = this._element.querySelector('.filter-bar__owner-btn') as HTMLElement;
        this._addListener(ownerBtn, 'click', (e: Event) => {
            e.stopPropagation();
            this.#closeDateDropdown();
            this.#toggleOwnerDropdown();
        });

        const ownerDropdown = this._element.querySelector(
            '.filter-bar__owner-dropdown'
        ) as HTMLElement;
        this._addListener(ownerDropdown, 'click', (e: Event) => {
            e.stopPropagation();
            const item = (e.target as HTMLElement).closest('[data-owner]') as HTMLElement | null;
            if (!item) return;
            this.#selectOwner(item.dataset.owner!);
            this.#closeOwnerDropdown();
        });

        const clearBtn = this._element.querySelector('.filter-bar__clear-btn') as HTMLElement;
        this._addListener(clearBtn, 'click', () => {
            this.#clearFilters();
        });

        this._addListener(document, 'click', () => {
            if (this.#dateOpen) this.#closeDateDropdown();
            if (this.#ownerOpen) this.#closeOwnerDropdown();
        });
    }

    #toggleDateDropdown(): void {
        if (this.#dateOpen) {
            this.#closeDateDropdown();
        } else {
            this.#openDateDropdown();
        }
    }

    #openDateDropdown(): void {
        this.#dateOpen = true;
        this._element
            .querySelector('.filter-bar__date-dropdown')!
            .classList.add('filter-bar__date-dropdown_visible');
    }

    #closeDateDropdown(): void {
        this.#dateOpen = false;
        this._element
            .querySelector('.filter-bar__date-dropdown')!
            .classList.remove('filter-bar__date-dropdown_visible');
    }

    #toggleOwnerDropdown(): void {
        if (this.#ownerOpen) {
            this.#closeOwnerDropdown();
        } else {
            this.#openOwnerDropdown();
        }
    }

    #openOwnerDropdown(): void {
        this.#ownerOpen = true;
        this._element
            .querySelector('.filter-bar__owner-dropdown')!
            .classList.add('filter-bar__owner-dropdown_visible');
    }

    #closeOwnerDropdown(): void {
        this.#ownerOpen = false;
        this._element
            .querySelector('.filter-bar__owner-dropdown')!
            .classList.remove('filter-bar__owner-dropdown_visible');
    }

    #selectOwner(owner: string): void {
        const btn = this._element.querySelector('.filter-bar__owner-btn') as HTMLElement;
        btn.textContent = `${owner} - Владелец`;
        btn.classList.add('filter-bar__dropdown-btn_active');
        this.#onFilterChange({ owner });
    }

    #onDateChange(): void {
        const dateFrom =
            (this._element.querySelector('.filter-bar__date-from') as HTMLInputElement).value ||
            null;
        const dateTo =
            (this._element.querySelector('.filter-bar__date-to') as HTMLInputElement).value || null;
        const dateBtn = this._element.querySelector('.filter-bar__date-btn') as HTMLElement;

        if (dateFrom || dateTo) {
            dateBtn.classList.add('filter-bar__dropdown-btn_active');
            const parts: string[] = [];
            if (dateFrom) parts.push(`с ${this.#formatDate(dateFrom)}`);
            if (dateTo) parts.push(`по ${this.#formatDate(dateTo)}`);
            dateBtn.textContent = parts.join(' ');
        } else {
            dateBtn.classList.remove('filter-bar__dropdown-btn_active');
            dateBtn.textContent = 'Изменено';
        }

        this.#onFilterChange({ dateFrom, dateTo });
    }

    #formatDate(isoDate: string): string {
        const [y, m, d] = isoDate.split('-');
        return `${d}.${m}.${y}`;
    }

    #clearFilters(): void {
        const ownerBtn = this._element.querySelector('.filter-bar__owner-btn') as HTMLElement;
        ownerBtn.textContent = 'Владелец';
        ownerBtn.classList.remove('filter-bar__dropdown-btn_active');

        const dateBtn = this._element.querySelector('.filter-bar__date-btn') as HTMLElement;
        dateBtn.classList.remove('filter-bar__dropdown-btn_active');
        dateBtn.textContent = 'Изменено';

        (this._element.querySelector('.filter-bar__date-from') as HTMLInputElement).value = '';
        (this._element.querySelector('.filter-bar__date-to') as HTMLInputElement).value = '';
        (this._element.querySelector('.filter-bar__search-input') as HTMLInputElement).value = '';

        clearTimeout(this.#searchDebounce!);
        this.#onFilterChange({ owner: null, dateFrom: null, dateTo: null, search: '' });
    }
}
