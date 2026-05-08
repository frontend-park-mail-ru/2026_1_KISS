import { escapeHtml } from '../../utils/escapeHtml.js';

/**
 * Рендерит HTML-разметку текстовой ячейки: contenteditable-блок и action-кнопки.
 * Содержимое экранируется через escapeHtml для защиты от XSS при первичной отрисовке.
 *
 * В режиме readonly contenteditable выставляется в "false", корневой элемент получает
 * модификатор text-cell--readonly, а action-кнопки не рендерятся.
 * @param ctx - id блока, его начальное содержимое и опциональный флаг readonly
 * @returns HTML-разметка для innerHTML
 */
export function TextCellTemplate(ctx: { id: string; content: string; readonly?: boolean }): string {
    const readonlyClass = ctx.readonly ? ' text-cell--readonly' : '';
    const contentEditable = ctx.readonly ? 'false' : 'true';
    return `<div class="text-cell${readonlyClass}" data-block-id="${escapeHtml(ctx.id)}">
    <div class="text-cell__content" contenteditable="${contentEditable}" data-placeholder="Введите текст...">${escapeHtml(ctx.content)}</div>
    ${
        ctx.readonly
            ? ''
            : `<div class="text-cell__actions">
        <button class="text-cell__action-btn" data-action="move-up" title="Переместить вверх">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
        <button class="text-cell__action-btn" data-action="move-down" title="Переместить вниз">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <button class="text-cell__action-btn" data-action="copy" title="Копировать">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button class="text-cell__action-btn text-cell__action-btn--delete" data-action="delete" title="Удалить">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
    </div>`
    }
</div>`;
}
