import { escapeHtml } from '../../utils/escapeHtml.js';

/**
 * Описание одной "ячейки" в визуальном ряду пагинации.
 */
interface PaginationPageItem {
    /** 'ellipsis' для троеточия, иначе обычная страница */
    type?: string;
    /** Номер страницы (для type !== 'ellipsis') */
    number?: number;
    /** true если это текущая активная страница */
    isActive?: boolean;
}

/**
 * Альтернативный шаблон пагинации с кнопками first/prev/next/last (|< < > >|).
 * В текущей кодовой базе основной Pagination.ts генерирует HTML самостоятельно,
 * этот шаблон оставлен для совместимости/будущего использования.
 * @param ctx - данные о видимых страницах и кнопках навигации
 * @returns HTML-разметка пагинации
 */
export function PaginationTemplate(ctx: {
    hasPrev: boolean;
    hasNext: boolean;
    prevPage: number;
    nextPage: number;
    pages: PaginationPageItem[];
}): string {
    return `<div class="pagination">
    <button class="pagination__btn" data-page="first" ${!ctx.hasPrev ? 'disabled' : ''}>|&lt;</button>

    <button class="pagination__btn" data-page="${escapeHtml(ctx.prevPage)}" ${!ctx.hasPrev ? 'disabled' : ''}>&lt;</button>

    ${ctx.pages
        .map((item) => {
            if (item.type === 'ellipsis') {
                return '<span class="pagination__ellipsis">...</span>';
            }
            return `<button class="pagination__btn ${
                item.isActive === true ? 'pagination__btn_active' : ''
            }" data-page="${escapeHtml(item.number)}">${escapeHtml(item.number)}</button>`;
        })
        .join('\n    ')}

    <button class="pagination__btn" data-page="${escapeHtml(ctx.nextPage)}" ${!ctx.hasNext ? 'disabled' : ''}>&gt;</button>

    <button class="pagination__btn" data-page="last" ${!ctx.hasNext ? 'disabled' : ''}>&gt;|</button>
</div>`;
}
