import { escapeHtml } from '../../utils/escapeHtml.js';

interface PaginationPageItem {
    type?: string;
    number?: number;
    isActive?: boolean;
}

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
            return (
                `<button class="pagination__btn ${ 
                item.isActive ? 'pagination__btn_active' : '' 
                }" data-page="${ 
                escapeHtml(item.number) 
                }">${ 
                escapeHtml(item.number) 
                }</button>`
            );
        })
        .join('\n    ')}

    <button class="pagination__btn" data-page="${escapeHtml(ctx.nextPage)}" ${!ctx.hasNext ? 'disabled' : ''}>&gt;</button>

    <button class="pagination__btn" data-page="last" ${!ctx.hasNext ? 'disabled' : ''}>&gt;|</button>
</div>`;
}
