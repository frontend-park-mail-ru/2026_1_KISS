/**
 * Рендерит секцию управления подпиской в профиле. Содержит карточку текущего
 * плана, две карточки доступных тарифов (Pro/Max) с кнопками оплаты и пустой
 * контейнер для встраивания виджета ЮKassa в режиме embedded.
 * Сами карточки тарифов наполняются динамически из API в SubscriptionSection.
 * @returns HTML-разметка для innerHTML
 */
export function SubscriptionSectionTemplate(): string {
    return `<div class="subscription-section">
    <h2 class="subscription-section__title">Подписка</h2>

    <div class="subscription-section__current" data-current>
        <div class="subscription-section__plan-name">—</div>
        <p class="subscription-section__plan-desc"></p>
    </div>

    <h3 class="subscription-section__subtitle">Доступные тарифы</h3>
    <div class="subscription-section__plans" data-plans></div>

    <div class="subscription-section__widget-wrap" data-widget-wrap hidden>
        <div class="subscription-section__widget-header">
            <span>Оплата подписки (тестовый режим)</span>
            <button type="button" class="subscription-section__close" data-close>×</button>
        </div>
        <div id="yookassa-payment-widget"></div>
    </div>

    <div class="subscription-section__status" data-status hidden></div>

    <p class="subscription-section__notice">
        Внимание: интеграция работает в тестовом режиме ЮKassa.
        Используйте тестовую карту 5555 5555 5555 4477, дату 01/30 и CVC 123.
    </p>
</div>`;
}
