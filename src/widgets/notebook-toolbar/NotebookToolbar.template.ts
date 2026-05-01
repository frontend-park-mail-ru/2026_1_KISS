export function NotebookToolbarTemplate(): string {
    return `<div class="notebook-toolbar">
    <div class="notebook-toolbar__stats-slot"></div>
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
