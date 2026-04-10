import { escapeHtml } from '../../utils/escapeHtml.js';

export function TextCellTemplate(ctx) {
    return `<div class="text-cell" data-block-id="${escapeHtml(ctx.id)}">
    <div class="text-cell__content" contenteditable="true" data-placeholder="Введите текст...">${escapeHtml(ctx.content)}</div>
    <div class="text-cell__actions">
        <button class="text-cell__action-btn" data-action="move-up" title="Переместить вверх">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
        <button class="text-cell__action-btn" data-action="move-down" title="Переместить вниз">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <button class="text-cell__action-btn" data-action="copy" title="Копировать">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
    </div>
</div>`;
}
