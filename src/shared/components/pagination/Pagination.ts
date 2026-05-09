import { BaseComponent } from '../base-component/BaseComponent.js';
import type { PageChangeCallback } from '../../types.js';
import { nn } from '../../utils/notNull.js';

/**
 * Компонент пагинации с поддержкой эллипсисов и кнопок prev/next.
 * Виден только при totalPages > 1; иначе скрывает себя через display:none.
 * Стиль кнопок намеренно стилизован "под код" (i=0, n=N, --i, i++) — отражает
 * математическую/программистскую тему проекта.
 */
export class Pagination extends BaseComponent {
    #currentPage: number;
    #totalPages: number | null;
    #onPageChange: PageChangeCallback;
    #visiblePagesCount = 5;

    /**
     * Создаёт пагинацию с callback'ом на изменение страницы. Сразу рендерит
     * пустой контейнер; реальные кнопки появляются после первого вызова update().
     * @param parent - родительский элемент
     * @param onPageChange - вызывается с индексом новой страницы (0-based)
     */
    public constructor(parent: HTMLElement, onPageChange: PageChangeCallback) {
        super(null, parent);
        this.#currentPage = 0;
        this.#totalPages = null;
        this.#onPageChange = onPageChange;
        this.#render();
    }

    /**
     * Создаёт корневой div и сразу обновляет содержимое (которое будет пустым
     * пока totalPages не задан).
     */
    #render(): void {
        this._element = document.createElement('div');
        this._element.className = 'pagination';
        this.#updateElementContent();
    }

    /**
     * Перерисовывает innerHTML на основе текущего #currentPage/#totalPages.
     * Если страниц <= 1 — оставляет пустым.
     */
    #updateElementContent(): void {
        if (this.#totalPages === null || this.#totalPages <= 1) {
            this._element.innerHTML = '';
            return;
        }
        this._element.innerHTML = this.#generateHTML();
    }

    /**
     * Генерирует строку HTML кнопок пагинации. Включает prev (если не первая
     * страница), видимые номера с эллипсисами и next (если не последняя).
     * @returns HTML-разметка для innerHTML
     */
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
                    buttonText = `i=${String(page)}`;
                } else if (page === lastPage && hasEllipsisEnd) {
                    buttonText = `n=${String(lastPage)}`;
                } else {
                    buttonText = String(page);
                }

                html += `<button class="pagination__btn ${isActive ? 'pagination__btn_active' : ''}" data-page="${String(page)}">${buttonText}</button>`;
            }
        });

        if (hasNext) {
            html += '<button class="pagination__btn" data-page="next">i++</button>';
        }

        return html;
    }

    /**
     * Вычисляет какие номера страниц показать в навигации (с учётом эллипсисов).
     * Логика: если страниц мало — показать все; иначе сцентрировать окно вокруг
     * текущей страницы, добавив эллипсисы в начало/конец где нужно.
     * @returns массив номеров страниц или строк-маркеров эллипсисов
     */
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

    /**
     * Обновляет состояние пагинации: текущую страницу и общее количество.
     * Принимает любые числа — клампит к [0; totalPages-1] и приводит NaN к 0.
     * Автоматически скрывает себя если страниц <= 1.
     * @param currentPage - индекс текущей страницы (0-based)
     * @param totalPages - общее количество страниц
     */
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

    /**
     * Делает компонент видимым (убирает display:none).
     */
    public show(): void {
        this._element.style.display = '';
    }

    /**
     * Скрывает компонент через display:none. Слушатели и состояние сохраняются.
     */
    public hide(): void {
        this._element.style.display = 'none';
    }

    /**
     * Маунтит компонент в DOM скрытым (логика показа в update()) и навешивает
     * делегированный обработчик кликов по кнопкам.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.hide();
        this.#attachEvents();
    }

    /**
     * Снимает с DOM и снимает обработчики (через super.unmount → _clearListeners).
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Делегированный обработчик кликов: парсит data-page кнопки (число, 'prev'
     * или 'next'), валидирует целевую страницу и вызывает onPageChange.
     */
    #attachEvents(): void {
        this._addListener(this._element, 'click', (e: unknown) => {
            const btn = ((e as MouseEvent).target as HTMLElement).closest<HTMLButtonElement>(
                '[data-page]'
            );
            if (!btn || btn.disabled) return;

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
