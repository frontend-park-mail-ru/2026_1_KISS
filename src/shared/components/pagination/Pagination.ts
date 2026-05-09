import { BaseComponent } from '../base-component/BaseComponent.js';
import type { PageChangeCallback } from '../../types.js';
import { nn } from '../../utils/notNull.js';

export class Pagination extends BaseComponent {
    #currentPage: number;
    #totalPages: number | null;
    #onPageChange: PageChangeCallback;
    #visiblePagesCount = 5;

    public constructor(parent: HTMLElement, onPageChange: PageChangeCallback) {
        super(null, parent);
        this.#currentPage = 0;
        this.#totalPages = null;
        this.#onPageChange = onPageChange;
        this.#render();
    }

    #render(): void {
        this._element = document.createElement('div');
        this._element.className = 'pagination';
        this.#updateElementContent();
    }

    #updateElementContent(): void {
        if (this.#totalPages === null || this.#totalPages <= 1) {
            this._element.innerHTML = '';
            return;
        }
        this._element.innerHTML = this.#generateHTML();
    }

    #generateHTML(): string {
        const hasPrev = this.#currentPage > 0;
        const hasNext = this.#currentPage < nn(this.#totalPages) - 1;
        const lastPage = nn(this.#totalPages) - 1;

        let html = '<span class="pagination__label">for</span>';

        if (hasPrev) {
            html += '<button class="pagination__btn" data-page="prev">--i</button>';
        }

        const visiblePages = this.#getVisiblePages();
        let hasEllipsisEnd = false;

        visiblePages.forEach((page) => {
            if (page === 'ellipsis-start') {
                html += '<span class="pagination__ellipsis">....</span>';
            } else if (page === 'ellipsis-end') {
                hasEllipsisEnd = true;
                html += '<span class="pagination__ellipsis">....</span>';
            } else {
                const isActive = page === this.#currentPage;
                let buttonText: string;

                if (isActive) {
                    buttonText = `i=${page}`;
                } else if (page === lastPage && hasEllipsisEnd) {
                    buttonText = `n=${lastPage}`;
                } else {
                    buttonText = `${page}`;
                }

                html += `<button class="pagination__btn ${isActive ? 'pagination__btn_active' : ''}" data-page="${page}">${buttonText}</button>`;
            }
        });

        if (hasNext) {
            html += '<button class="pagination__btn" data-page="next">i++</button>';
        }

        return html;
    }

    #getVisiblePages(): (number | string)[] {
        const pages: (number | string)[] = [];
        const total = nn(this.#totalPages);
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

    public update(currentPage: number, totalPages: number): void {
        const safeTotalPages =
            typeof totalPages === 'number' && Number.isFinite(totalPages)
                ? Math.max(0, Math.floor(totalPages))
                : 0;
        const maxPageIndex = Math.max(0, safeTotalPages - 1);

        this.#currentPage =
            typeof currentPage === 'number' && Number.isFinite(currentPage)
                ? Math.min(Math.max(0, Math.floor(currentPage)), maxPageIndex)
                : 0;
        this.#totalPages = safeTotalPages;
        this._clearListeners();
        this.#updateElementContent();
        this.#attachEvents();
        if (safeTotalPages <= 1) {
            this.hide();
        } else {
            this.show();
        }
    }

    public show(): void {
        this._element.style.display = '';
    }

    public hide(): void {
        this._element.style.display = 'none';
    }

    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.hide();
        this.#attachEvents();
    }

    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    #attachEvents(): void {
        this._addListener(this._element, 'click', (e: unknown) => {
            const btn = ((e as MouseEvent).target as HTMLElement).closest(
                '[data-page]'
            );
            if (!btn || (btn as HTMLButtonElement).disabled) return;

            const pageAttr = nn(btn.dataset.page);
            let targetPage: number;

            if (pageAttr === 'prev') {
                targetPage = this.#currentPage - 1;
            } else if (pageAttr === 'next') {
                targetPage = this.#currentPage + 1;
            } else {
                targetPage = parseInt(pageAttr, 10);
            }

            if (
                !isNaN(targetPage) &&
                targetPage !== this.#currentPage &&
                targetPage >= 0 &&
                targetPage < nn(this.#totalPages)
            ) {
                this.#onPageChange(targetPage);
            }
        });
    }
}
