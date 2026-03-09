import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';

export class FilterBar extends BaseComponent {
    #onCreate;
    #onFilterChange;
    #dateOpen = false;
    #ownerOpen = false;

    constructor(parent, { onCreate, onFilterChange }) {
        super(null, parent);
        this.#onCreate = onCreate;
        this.#onFilterChange = onFilterChange;
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['FilterBar'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template({});
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

    #attachEvents() {
        const createBtn = this._element.querySelector('.filter-bar__create-btn');
        this._addListener(createBtn, 'click', () => {
            this.#onCreate();
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

    #toggleDateDropdown() {
        this.#dateOpen ? this.#closeDateDropdown() : this.#openDateDropdown();
    }

    #openDateDropdown() {
        this.#dateOpen = true;
        this._element
            .querySelector('.filter-bar__date-dropdown')
            .classList.add('filter-bar__date-dropdown_visible');
    }

    #closeDateDropdown() {
        this.#dateOpen = false;
        this._element
            .querySelector('.filter-bar__date-dropdown')
            .classList.remove('filter-bar__date-dropdown_visible');
    }

    #toggleOwnerDropdown() {
        this.#ownerOpen ? this.#closeOwnerDropdown() : this.#openOwnerDropdown();
    }

    #openOwnerDropdown() {
        this.#ownerOpen = true;
        this._element
            .querySelector('.filter-bar__owner-dropdown')
            .classList.add('filter-bar__owner-dropdown_visible');
    }

    #closeOwnerDropdown() {
        this.#ownerOpen = false;
        this._element
            .querySelector('.filter-bar__owner-dropdown')
            .classList.remove('filter-bar__owner-dropdown_visible');
    }

    #selectOwner(owner) {
        const btn = this._element.querySelector('.filter-bar__owner-btn');
        btn.textContent = `${owner} - Владелец`;
        btn.classList.add('filter-bar__dropdown-btn_active');
        if (this.#onFilterChange) {
            this.#onFilterChange({ owner });
        }
    }

    #onDateChange() {
        const dateFrom = this._element.querySelector('.filter-bar__date-from').value || null;
        const dateTo = this._element.querySelector('.filter-bar__date-to').value || null;
        const dateBtn = this._element.querySelector('.filter-bar__date-btn');

        if (dateFrom || dateTo) {
            dateBtn.classList.add('filter-bar__dropdown-btn_active');
        } else {
            dateBtn.classList.remove('filter-bar__dropdown-btn_active');
        }

        if (this.#onFilterChange) {
            this.#onFilterChange({ dateFrom, dateTo });
        }
    }

    #clearFilters() {
        const ownerBtn = this._element.querySelector('.filter-bar__owner-btn');
        ownerBtn.textContent = 'Владелец';
        ownerBtn.classList.remove('filter-bar__dropdown-btn_active');

        const dateBtn = this._element.querySelector('.filter-bar__date-btn');
        dateBtn.classList.remove('filter-bar__dropdown-btn_active');

        this._element.querySelector('.filter-bar__date-from').value = '';
        this._element.querySelector('.filter-bar__date-to').value = '';

        if (this.#onFilterChange) {
            this.#onFilterChange({ owner: null, dateFrom: null, dateTo: null });
        }
    }
}
