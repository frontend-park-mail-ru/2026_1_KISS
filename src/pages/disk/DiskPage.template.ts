/**
 * Шаблон страницы «Диск»: контейнер для шапки, карточки квоты, drop-зоны,
 * табов (мои файлы / расшарено со мной), таблицы файлов и пагинации.
 * @returns HTML-разметка для innerHTML
 */
export function DiskPageTemplate(): string {
    return `<div class="disk-page">
    <div class="disk-page__header-mount"></div>
    <main class="disk-page__main">
        <div class="disk-page__title-row">
            <h1 class="disk-page__title">Мой диск</h1>
        </div>
        <div class="disk-page__usage-mount"></div>
        <div class="disk-page__tabs">
            <button type="button" class="disk-page__tab disk-page__tab_active" data-tab="own">Мои файлы</button>
            <button type="button" class="disk-page__tab" data-tab="shared">Расшарено со мной</button>
        </div>
        <div class="disk-page__panel disk-page__panel_own">
            <div class="disk-page__drop-mount"></div>
            <div class="disk-page__table-mount"></div>
            <div class="disk-page__pagination-mount"></div>
        </div>
        <div class="disk-page__panel disk-page__panel_shared" hidden>
            <div class="disk-page__shared-table-mount"></div>
            <div class="disk-page__shared-pagination-mount"></div>
        </div>
    </main>
</div>`;
}
