/**
 * Рендерит панель инструментов notebook'а: чекбокс показа комментариев,
 * кнопки добавления code/text-блоков, "Выполнить все".
 * @returns HTML-разметка для innerHTML
 */
export function NotebookToolbarTemplate(): string {
    return `<div class="notebook-toolbar">
    <label class="notebook-toolbar__toggle" data-action="toggle-comments">
        <input type="checkbox" class="notebook-toolbar__toggle-input">
        <span class="notebook-toolbar__toggle-label">Комментарии</span>
    </label>
    <div class="notebook-toolbar__buttons">
        <button class="notebook-toolbar__btn notebook-toolbar__btn--add" data-action="add-code">+ Код</button>
        <button class="notebook-toolbar__btn notebook-toolbar__btn--add" data-action="add-text">+ Текст</button>
        <button class="notebook-toolbar__btn notebook-toolbar__btn--run" data-action="run-all">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
            Выполнить все
        </button>
    </div>
</div>`;
}
