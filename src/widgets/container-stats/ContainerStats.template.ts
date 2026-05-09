/**
 * Рендерит каркас панели статистики контейнера (RAM/CPU и progress-bar).
 * Реальные значения подгружаются из RunnerApi.getContainerStats полингом.
 * @returns HTML-разметка для innerHTML
 */
export function ContainerStatsTemplate(): string {
    return `<div class="container-stats container-stats--inactive">
    <div class="container-stats__item">
        <span class="container-stats__label">RAM</span>
        <span class="container-stats__value" data-metric="ram">—</span>
    </div>
    <div class="container-stats__item">
        <span class="container-stats__label">CPU</span>
        <span class="container-stats__value" data-metric="cpu">—</span>
    </div>
    <div class="container-stats__bar">
        <div class="container-stats__bar-fill"></div>
    </div>
</div>`;
}
