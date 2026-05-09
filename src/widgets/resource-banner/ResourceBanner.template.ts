/**
 * Рендерит баннер с информацией о тарифе: план, прогресс-бар квоты,
 * хранилище, количество ноутбуков. Значения подставляются по data-field.
 * @returns HTML-разметка для innerHTML
 */
export function ResourceBannerTemplate(): string {
    return `<div class="resource-banner">
    <div class="resource-banner__item">
        <span class="resource-banner__label">План</span>
        <span class="resource-banner__badge" data-field="plan">—</span>
    </div>
    <div class="resource-banner__item resource-banner__item--quota">
        <span class="resource-banner__label">Квота</span>
        <div class="resource-banner__progress">
            <div class="resource-banner__progress-fill"></div>
        </div>
        <span class="resource-banner__value" data-field="quota">—</span>
    </div>
    <div class="resource-banner__item">
        <span class="resource-banner__label">Хранилище</span>
        <span class="resource-banner__value" data-field="storage">—</span>
    </div>
    <div class="resource-banner__item">
        <span class="resource-banner__label">Ноутбуки</span>
        <span class="resource-banner__value" data-field="notebooks">—</span>
    </div>
</div>`;
}
