/**
 * Рендерит каркас CellList: контейнер для ячеек + empty-state с подсказкой.
 * Сами ячейки (CodeCell/TextCell) монтируются в .cell-list__cells динамически.
 * @returns HTML-разметка для innerHTML
 */
export function CellListTemplate(): string {
    return `<div class="cell-list">
    <div class="cell-list__cells"></div>
    <div class="cell-list__empty-state">
        <p>Нет ячеек. Нажмите <strong>+ Код</strong> или <strong>+ Текст</strong> для добавления.</p>
    </div>
</div>`;
}
