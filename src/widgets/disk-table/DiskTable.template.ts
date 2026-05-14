/**
 * Рендерит каркас таблицы файлов: имя, владелец, размер, тип, скачиваний,
 * дата. Действия скрыты, для них используется контекстное меню по правой
 * кнопке мыши на строке.
 * @returns HTML-разметка для innerHTML
 */
export function DiskTableTemplate(): string {
    return `<div class="disk-table">
    <table class="disk-table__table">
        <thead>
            <tr class="disk-table__header-row">
                <th class="disk-table__header disk-table__header_name">Имя</th>
                <th class="disk-table__header disk-table__header_owner">Владелец</th>
                <th class="disk-table__header disk-table__header_size">Размер</th>
                <th class="disk-table__header disk-table__header_mime">Тип</th>
                <th class="disk-table__header disk-table__header_downloads">Скачиваний</th>
                <th class="disk-table__header disk-table__header_date">Дата</th>
            </tr>
        </thead>
        <tbody class="disk-table__body"></tbody>
    </table>
    <div class="disk-table__empty" style="display:none;">У вас пока нет файлов</div>
</div>`;
}
