import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { FilterBarTemplate } from './FilterBar.template.js';
import { nn } from '../../shared/utils/notNull.js';

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

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = FilterBarTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

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
            if (!Boolean(item?.dataset.owner)) return;
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

    #toggleDateDropdown(): void {
        if (this.#dateOpen) {
            this.#closeDateDropdown();
        } else {
            this.#openDateDropdown();
        }
    }

    #openDateDropdown(): void {
        this.#dateOpen = true;
        nn(this._element.querySelector('.filter-bar__date-dropdown')).classList.add(
            'filter-bar__date-dropdown_visible'
        );
    }

    #closeDateDropdown(): void {
        this.#dateOpen = false;
        nn(this._element.querySelector('.filter-bar__date-dropdown')).classList.remove(
            'filter-bar__date-dropdown_visible'
        );
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
        nn(this._element.querySelector('.filter-bar__owner-dropdown')).classList.add(
            'filter-bar__owner-dropdown_visible'
        );
    }

    #closeOwnerDropdown(): void {
        this.#ownerOpen = false;
        nn(this._element.querySelector('.filter-bar__owner-dropdown')).classList.remove(
            'filter-bar__owner-dropdown_visible'
        );
    }

    #selectOwner(owner: string): void {
        const btn = nn(this._element.querySelector('.filter-bar__owner-btn'));
        btn.textContent = `${owner} - Владелец`;
        btn.classList.add('filter-bar__dropdown-btn_active');
        this.#onFilterChange({ owner });
    }

    #onDateChange(): void {
        const dateFrom =
            nn(this._element.querySelector<HTMLInputElement>('.filter-bar__date-from')).value ||
            null;
        const dateTo =
            nn(this._element.querySelector<HTMLInputElement>('.filter-bar__date-to')).value ||
            null;
        const dateBtn = nn(this._element.querySelector('.filter-bar__date-btn'));

        if (Boolean(dateFrom) || Boolean(dateTo)) {
            dateBtn.classList.add('filter-bar__dropdown-btn_active');
            const parts: string[] = [];
            if (Boolean(dateFrom)) parts.push(`с ${this.#formatDate(dateFrom)}`);
            if (Boolean(dateTo)) parts.push(`по ${this.#formatDate(dateTo)}`);
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
