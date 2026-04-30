export function CellListTemplate(): string {
    return `<div class="cell-list">
    <div class="cell-list__cells"></div>
    <div class="cell-list__empty-state">
        <p>Нет ячеек. Нажмите <strong>+ Код</strong> или <strong>+ Текст</strong> для добавления.</p>
    </div>
</div>`;
}
