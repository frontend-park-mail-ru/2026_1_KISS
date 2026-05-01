export function StatsSectionTemplate(): string {
    return `<div class="stats-section">
    <h2 class="stats-section__title">Статистика</h2>

    <div class="stats-section__quota">
        <div class="stats-section__quota-header">
            <span class="stats-section__plan-badge"></span>
            <span class="stats-section__quota-text"></span>
        </div>
        <div class="stats-section__progress-bar">
            <div class="stats-section__progress-fill"></div>
        </div>
    </div>

    <div class="stats-section__kpi">
        <div class="stats-section__kpi-card">
            <div class="stats-section__kpi-value" data-kpi="notebooks">—</div>
            <div class="stats-section__kpi-label">Ноутбуки</div>
        </div>
        <div class="stats-section__kpi-card">
            <div class="stats-section__kpi-value" data-kpi="blocks">—</div>
            <div class="stats-section__kpi-label">Блоки кода</div>
        </div>
        <div class="stats-section__kpi-card">
            <div class="stats-section__kpi-value" data-kpi="executions">—</div>
            <div class="stats-section__kpi-label">Запуски</div>
        </div>
    </div>

    <div class="stats-section__chart">
        <div class="stats-section__chart-title">Активность за 30 дней</div>
        <div class="stats-section__chart-container"></div>
    </div>

    <div class="stats-section__storage">
        <div class="stats-section__storage-title">Хранилище</div>
        <div class="stats-section__storage-cards"></div>
    </div>
</div>`;
}
