/**
 * Рендерит каркас таблицы файлов пользователя: заголовки (Имя/Размер/Тип/
 * Дата/Действия), пустой tbody (заполняется в DiskTable.setData) и
 * empty-state. Названия повторяют стиль FilesTable, чтобы UX был знакомым.
 * @returns HTML-разметка для innerHTML
 */
export function DiskTableTemplate(): string {
    return `<div class="disk-table">
    <table class="disk-table__table">
        <thead>
            <tr class="disk-table__header-row">
                <th class="disk-table__header">Имя</th>
                <th class="disk-table__header">Размер</th>
                <th class="disk-table__header">Тип</th>
                <th class="disk-table__header">Скачиваний</th>
                <th class="disk-table__header">Дата</th>
                <th class="disk-table__header disk-table__header_actions"></th>
            </tr>
        </thead>
        <tbody class="disk-table__body"></tbody>
    </table>
    <div class="disk-table__empty" style="display:none;">У вас пока нет загруженных файлов</div>
</div>`;
}
