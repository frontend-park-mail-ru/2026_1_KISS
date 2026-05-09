import { escapeHtml } from '../../utils/escapeHtml.js';

/**
 * Рендерит HTML-разметку code-ячейки: gutter с execution-number и Run-кнопкой,
 * редактор (line-numbers + textarea), скрытую output-секцию и колонку action-кнопок
 * (move-up/move-down/copy/delete).
 * @param ctx - id блока и его текущее содержимое
 * @returns HTML-разметка для innerHTML
 */
export function CodeCellTemplate(ctx: { id: string; content: string }): string {
    return `<div class="code-cell" data-block-id="${escapeHtml(ctx.id)}">
    <div class="code-cell__gutter">
        <span class="code-cell__execution-number">[ ]</span>
        <button class="code-cell__run-btn" title="Выполнить">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2l10 6-10 6V2z"/>
            </svg>
        </button>
    </div>
    <div class="code-cell__main">
        <div class="code-cell__editor">
            <div class="code-cell__line-numbers"></div>
            <textarea class="code-cell__textarea" wrap="off" spellcheck="false" placeholder="Введите код...">${escapeHtml(ctx.content)}</textarea>
        </div>
        <div class="code-cell__output" hidden>
            <pre class="code-cell__output-stdout"></pre>
            <pre class="code-cell__output-stderr"></pre>
            <pre class="code-cell__output-result"></pre>
            <div class="code-cell__output-images"></div>
        </div>
    </div>
    <div class="code-cell__actions">
        <button class="code-cell__action-btn" data-action="move-up" title="Переместить вверх">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
        <button class="code-cell__action-btn" data-action="move-down" title="Переместить вниз">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <button class="code-cell__action-btn" data-action="copy" title="Копировать">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button class="code-cell__action-btn code-cell__action-btn--delete" data-action="delete" title="Удалить">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
    </div>
</div>`;
}
