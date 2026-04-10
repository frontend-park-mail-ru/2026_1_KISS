export function NotebookToolbarTemplate() {
    return `<div class="notebook-toolbar">
    <div class="notebook-toolbar__search">
        <svg class="notebook-toolbar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" class="notebook-toolbar__search-input" placeholder="Поиск по ячейкам...">
    </div>
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
