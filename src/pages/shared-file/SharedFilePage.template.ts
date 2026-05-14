import { escapeHtml } from '../../shared/utils/escapeHtml.js';

/**
 * Рендерит каркас публичной страницы скачивания. Реальный контент (имя, размер,
 * кнопка) вставляется JS-кодом после fetch'a /api/v1/shared/files/:token.
 * @returns HTML-разметка для innerHTML
 */
export function SharedFilePageTemplate(): string {
    return `<div class="shared-file-page">
    <header class="shared-file-page__header">
        <a class="shared-file-page__brand" href="/">KISS Colab</a>
    </header>
    <main class="shared-file-page__main">
        <div class="shared-file-page__card">
            <div class="shared-file-page__content">
                <p class="shared-file-page__status">Загрузка…</p>
            </div>
        </div>
    </main>
</div>`;
}

/**
 * Рендерит содержимое успешной карточки файла.
 * @param filename - имя файла
 * @param size - размер в байтах (отформатировано)
 * @param mime - MIME-тип
 * @param downloadHref - ссылка на скачивание (proxy для download endpoint)
 * @returns HTML-разметка карточки
 */
export function SharedFileCard(
    filename: string,
    size: string,
    mime: string,
    downloadHref: string
): string {
    return `<div class="shared-file-page__file-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
        </svg>
    </div>
    <h2 class="shared-file-page__filename">${escapeHtml(filename)}</h2>
    <p class="shared-file-page__meta">${escapeHtml(size)} · ${escapeHtml(mime)}</p>
    <a class="shared-file-page__download" href="${escapeHtml(downloadHref)}" download>Скачать</a>`;
}
