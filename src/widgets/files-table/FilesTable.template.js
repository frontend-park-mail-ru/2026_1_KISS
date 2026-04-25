function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function FilesTableTemplate() {
    return `<div class="files-table">
    <table class="files-table__table">
        <thead>
            <tr class="files-table__header-row">
                <th class="files-table__header">Название</th>
                <th class="files-table__header">Дата изменения</th>
                <th class="files-table__header">Владелец</th>
                <th class="files-table__header files-table__header_actions">
                    <button class="files-table__sort-trigger">&#9776;</button>
                    <div class="files-table__sort-dropdown">
                        <div class="files-table__sort-title">Сортировать по</div>
                        <button class="files-table__sort-option" data-sort="date">
                            <span>Дата изменения</span>
                            <span class="files-table__sort-arrows">
                                <span class="files-table__sort-arrow" data-dir="asc">&#9650;</span>
                                <span class="files-table__sort-arrow" data-dir="desc">&#9660;</span>
                            </span>
                        </button>
                        <button class="files-table__sort-option" data-sort="title">
                            <span>Название</span>
                            <span class="files-table__sort-arrows">
                                <span class="files-table__sort-arrow" data-dir="asc">&#9650;</span>
                                <span class="files-table__sort-arrow" data-dir="desc">&#9660;</span>
                            </span>
                        </button>
                    </div>
                </th>
            </tr>
        </thead>
        <tbody class="files-table__body">
        </tbody>
    </table>
    <div class="files-table__empty-state" style="display: none;">
        <div class="files-table__empty-icon">K</div>
        <div class="files-table__empty-text">Начни работу</div>
    </div>
</div>`;
}

export function renderFileRow(file) {
    const formattedDate = file.updated_at
        ? new Date(file.updated_at).toLocaleDateString('ru-RU')
        : '—';

    const firstLetter = file.title ? file.title.charAt(0).toUpperCase() : 'Ф';

    return `
        <tr class="files-table__row" data-file-id="${file.id}">
            <td class="files-table__cell files-table__cell_name" data-label="Название">
                <span class="files-table__icon">${firstLetter}</span>
                <span class="files-table__title">${escapeHtml(file.title || 'Без названия')}</span>
            </td>
            <td class="files-table__cell" data-label="Дата изменения">${formattedDate}</td>
            <td class="files-table__cell" data-label="Владелец">${escapeHtml(file.owner || '—')}</td>
            <td class="files-table__cell files-table__kebab-cell" data-label="">
                <button class="kebab-menu__trigger" data-file-id="${file.id}">⋮</button>
            </td>
        </tr>
    `;
}
