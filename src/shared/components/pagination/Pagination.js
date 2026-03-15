/**
 * @module shared/components/pagination/Pagination
 */

import { BaseComponent } from '../base-component/BaseComponent.js';

/** @typedef {import('../../types.js').PageChangeCallback} PageChangeCallback */

/**
 * Пагинатор со стилизацией «for (i=...; i++; --i)».
 * Показывает окно из 5 страниц с эллипсами и кнопками prev/next.
 *
 * @extends BaseComponent
 */
export class Pagination extends BaseComponent {
    /** @type {number} */
    #currentPage;

    /** @type {?number} */
    #totalPages;

    /** @type {PageChangeCallback} */
    #onPageChange;

    /** @type {number} */
    #visiblePagesCount = 5;

    /**
     * @param {HTMLElement} parent -- контейнер для mount
     * @param {PageChangeCallback} onPageChange -- колбэк при смене страницы (0-based)
     */
    constructor(parent, onPageChange) {
        super(null, parent);
        this.#currentPage = 0;
        this.#totalPages = null;
        this.#onPageChange = onPageChange;
        this.#render();
    }

    /** @private */
    #render() {
        this._element = document.createElement('div');
        this._element.className = 'pagination';
        this.#updateElementContent();
    }

    /** @private */
    #updateElementContent() {
        if (this.#totalPages === null || this.#totalPages <= 1) {
            this._element.innerHTML = '';
            return;
        }
        this._element.innerHTML = this.#generateHTML();
    }

    /**
     * Генерирует HTML-разметку кнопок пагинации.
     *
     * @private
     * @returns {string} HTML-строка
     */
    #generateHTML() {
        const hasPrev = this.#currentPage > 0;
        const hasNext = this.#currentPage < this.#totalPages - 1;
        const lastPage = this.#totalPages - 1;

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
                let buttonText;

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

    /**
     * Вычисляет массив видимых номеров страниц с эллипсами.
     *
     * @private
     * @returns {Array<number|string>} номера страниц и маркеры 'ellipsis-start'/'ellipsis-end'
     */
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

    /**
     * Обновляет пагинатор: перерисовывает кнопки и показывает/скрывает элемент.
     *
     * @param {number} currentPage -- текущая страница (0-based)
     * @param {number} totalPages -- общее количество страниц
     */
    update(currentPage, totalPages) {
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

    /**
     * Показывает элемент пагинации.
     */
    show() {
        if (this._element) {
            this._element.style.display = '';
        }
    }

    /**
     * Скрывает элемент пагинации.
     */
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

    /** @private */
    #attachEvents() {
        if (!this._element) return;
        this._addListener(this._element, 'click', (e) => {
            const btn = e.target.closest('[data-page]');
            if (!btn || btn.disabled) return;

            const pageAttr = btn.dataset.page;
            let targetPage;

            if (pageAttr === 'prev') {
                targetPage = this.#currentPage - 1;
            } else if (pageAttr === 'next') {
                targetPage = this.#currentPage + 1;
            } else {
                targetPage = parseInt(pageAttr);
            }

            if (
                !isNaN(targetPage) &&
                targetPage !== this.#currentPage &&
                targetPage >= 0 &&
                targetPage < this.#totalPages
            ) {
                this.#onPageChange(targetPage);
            }
        });
    }
}
