/**
 * Рендерит карточку заполненности диска с прогресс-баром и подписями.
 * Динамические значения вставляются DiskUsageCard.refresh.
 * @returns HTML-разметка для innerHTML
 */
export function DiskUsageCardTemplate(): string {
    return `<div class="disk-usage-card">
    <div class="disk-usage-card__header">
        <div class="disk-usage-card__title">Диск</div>
        <div class="disk-usage-card__plan"></div>
    </div>
    <div class="disk-usage-card__bar">
        <div class="disk-usage-card__bar-fill" style="width:0%"></div>
    </div>
    <div class="disk-usage-card__footer">
        <span class="disk-usage-card__usage"></span>
        <span class="disk-usage-card__count"></span>
    </div>
</div>`;
}
