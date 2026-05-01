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

    <div class="stats-section__info">
        <div class="stats-section__info-row">
            <span class="stats-section__info-label">Дата регистрации</span>
            <span class="stats-section__info-value" data-info="registered">--</span>
        </div>
        <div class="stats-section__info-row">
            <span class="stats-section__info-label">Последняя активность</span>
            <span class="stats-section__info-value" data-info="last-active">--</span>
        </div>
        <div class="stats-section__info-row">
            <span class="stats-section__info-label">Среднее в день</span>
            <span class="stats-section__info-value" data-info="avg-daily">--</span>
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
        <div class="stats-section__chart-title">Запуски за 30 дней <span class="stats-section__hint">?<span class="stats-section__tooltip">Количество уникальных блоков кода, которые вы запускали в каждый из последних 30 дней</span></span></div>
        <div class="stats-section__chart-container"></div>
    </div>

    <div class="stats-section__storage">
        <div class="stats-section__storage-title">Хранилище</div>
        <div class="stats-section__storage-cards"></div>
    </div>
</div>`;
}
