import { BaseComponent } from '../base-component/BaseComponent.js';

export class Pagination extends BaseComponent {
    #currentPage;
    #totalPages;
    #onPageChange;
    #visiblePagesCount = 5;

    constructor(parent, onPageChange) {
        super(null, parent);
        this.#currentPage = 0;
        this.#totalPages = null;
        this.#onPageChange = onPageChange;
        this.#render();
    }

    #render() {
        this._element = document.createElement('div');
        this._element.className = 'pagination';
        this.#updateElementContent();
    }

    #updateElementContent() {
        if (this.#totalPages === null || this.#totalPages <= 1) {
            this._element.innerHTML = '';
            return;
        }
        this._element.innerHTML = this.#generateHTML();
    }

    #generateHTML() {
        const hasPrev = this.#currentPage > 0;
        const hasNext = this.#currentPage < this.#totalPages - 1;
        const prevPage = this.#currentPage - 1;
        const nextPage = this.#currentPage + 1;
        const lastPage = this.#totalPages - 1;
        
        let html = '';
        
        html += `<button class="pagination__btn" data-page="first" ${!hasPrev ? 'disabled' : ''}>&lt;&lt;</button>`;
        
 
        html += `<button class="pagination__btn" data-page="${prevPage}" ${!hasPrev ? 'disabled' : ''}>&lt;</button>`;
        
        const visiblePages = this.#getVisiblePages();
        visiblePages.forEach(page => {
            if (page === 'ellipsis-start') {
                html += '<span class="pagination__ellipsis">....</span>';
            } else if (page === 'ellipsis-end') {
                html += '<span class="pagination__ellipsis">....</span>';
            } else {
                const isActive = page === this.#currentPage;
                let buttonText;
                
                if (page === 0) {
                    buttonText = 'for (--i) (i = 0)';
                } else if (page === lastPage) {
                    buttonText = `(n=${lastPage}) (i++)`;
                } else {
                    buttonText = `(i = ${page})`;
                }
                
                html += `<button class="pagination__btn ${isActive ? 'pagination__btn_active' : ''}" data-page="${page}">${buttonText}</button>`;
            }
        });
        
        html += `<button class="pagination__btn" data-page="${nextPage}" ${!hasNext ? 'disabled' : ''}>&gt;</button>`;
        
        html += `<button class="pagination__btn" data-page="last" ${!hasNext ? 'disabled' : ''}>&gt;&gt;</button>`;
        
        return html;
    }

    #getVisiblePages() {
        const pages = [];
        const total = this.#totalPages;
        const current = this.#currentPage;
        const visibleCount = this.#visiblePagesCount;
        
        if (total <= visibleCount) {
            for (let i = 0; i < total; i++) {
                pages.push(i);
            }
        } else {
            const firstPage = 0;
            const lastPage = total - 1;
       
            let startPage = Math.max(0, current - Math.floor(visibleCount / 2));
            let endPage = Math.min(total - 1, startPage + visibleCount - 1);
            
            if (endPage === total - 1) {
                startPage = Math.max(0, total - visibleCount);
            }

            if (startPage === 0) {
                endPage = Math.min(total - 1, visibleCount - 1);
            }
            
            if (startPage > firstPage + 1) {
                pages.push(firstPage);
                pages.push('ellipsis-start');
            } else if (startPage === firstPage + 1) {
                pages.push(firstPage);
            }
            
            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }
            
            if (endPage < lastPage - 1) {
                pages.push('ellipsis-end');
                pages.push(lastPage);
            } else if (endPage === lastPage - 1) {
                pages.push(lastPage);
            }
        }
        
        return pages;
    }

    update(currentPage, totalPages) {
        // console.log('Pagination update:', { currentPage, totalPages });
        if (typeof totalPages !== 'number' || totalPages <= 0) {
            console.warn('Invalid totalPages:', totalPages);
            return;
        }
        this.#currentPage = currentPage;
        this.#totalPages = totalPages;
        this.#clearListeners();
        this.#updateElementContent();
        this.#attachEvents();
        if (totalPages <= 1) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (this._element) {
            this._element.style.display = '';
        }
    }

    hide() {
        if (this._element) {
            this._element.style.display = 'none';
        }
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
        if (!this._element) return;
        this._addListener(this._element, 'click', (e) => {
            const btn = e.target.closest('[data-page]');
            if (!btn || btn.disabled) return;
            
            const pageAttr = btn.dataset.page;
            if (pageAttr === 'first') {
                if (this.#currentPage !== 0) {
                    this.#onPageChange(0);
                }
            } else if (pageAttr === 'last') {
                const lastPage = this.#totalPages - 1;
                if (this.#currentPage !== lastPage) {
                    this.#onPageChange(lastPage);
                }
            } else {
                const page = parseInt(pageAttr);
                if (!isNaN(page) && page !== this.#currentPage && page >= 0 && page < this.#totalPages) {
                    this.#onPageChange(page);
                }
            }
        });
    }

    #clearListeners() {
        if (this._element) {
            const newElement = this._element.cloneNode(false);
            if (this._element.parentNode) {
                this._element.parentNode.replaceChild(newElement, this._element);
            }
            this._element = newElement;
        }
    }
}