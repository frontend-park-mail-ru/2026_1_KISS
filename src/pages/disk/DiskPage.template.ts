/**
 * Шаблон страницы «Диск»: контейнер для шапки, карточки квоты, drop-зоны
 * и единой таблицы файлов (свои + расшаренные со мной).
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
        <div class="disk-page__drop-mount"></div>
        <div class="disk-page__table-mount"></div>
    </main>
</div>`;
}
