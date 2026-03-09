import { BaseComponent } from '../base-component/BaseComponent.js';

export class Pagination extends BaseComponent {
    #currentPage;
    #totalPages;
    #onPageChange;

    constructor(parent, onPageChange) {
        super(null, parent);
        this.#currentPage = 1;
        this.#totalPages = 1;
        this.#onPageChange = onPageChange;
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['Pagination'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template(this.#getTemplateData());
        this._element = tempContainer.firstElementChild;
    }

    #getTemplateData() {
        const pages = [];
        for (let i = 1; i <= this.#totalPages; i++) {
            pages.push({ number: i, isActive: i === this.#currentPage });
        }
        return {
            currentPage: this.#currentPage,
            totalPages: this.#totalPages,
            pages,
            hasPrev: this.#currentPage > 1,
            hasNext: this.#currentPage < this.#totalPages,
            prevPage: this.#currentPage - 1,
            nextPage: this.#currentPage + 1
        };
    }

    update(currentPage, totalPages) {
        this.#currentPage = currentPage;
        this.#totalPages = totalPages;
        this._clearListeners();

        const template = Handlebars.templates['Pagination'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template(this.#getTemplateData());
        const newElement = tempContainer.firstElementChild;

        if (this._isMounted && this._element.parentNode) {
            this._element.parentNode.replaceChild(newElement, this._element);
        }
        this._element = newElement;
        this.#attachEvents();
    }

    show() {
        this._element.style.display = '';
    }

    hide() {
        this._element.style.display = 'none';
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
        this.hide();
        this.#attachEvents();
    }

    unmount() {
        if (!this._isMounted) return;
        super.unmount();
    }

    #attachEvents() {
        this._addListener(this._element, 'click', (e) => {
            const btn = e.target.closest('[data-page]');
            if (!btn || btn.disabled) return;
            const page = parseInt(btn.dataset.page);
            if (page !== this.#currentPage && page >= 1 && page <= this.#totalPages) {
                this.#onPageChange(page);
            }
        });
    }
}
