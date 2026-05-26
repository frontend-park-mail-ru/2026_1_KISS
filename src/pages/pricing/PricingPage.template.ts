/**
 * Возвращает разметку страницы тарифов: hero-блок с заголовком и слот
 * data-table, в который PricingPage монтирует виджет PricingTable.
 * @returns HTML-разметку страницы с пустым контейнером таблицы
 */
export function PricingPageTemplate(): string {
    return `
        <main class="pricing-page">
            <section class="pricing-page__hero">
                <h1 class="pricing-page__title">Тарифы</h1>
                <p class="pricing-page__subtitle">Выберите план, подходящий вашему стилю разработки. В любой момент можно сменить тариф из профиля.</p>
            </section>
            <section class="pricing-page__table-wrap" data-table></section>
            <section class="pricing-page__footnote">
                <p>Подписка списывается через ЮKassa в тестовом режиме. Реальные деньги не списываются.</p>
            </section>
        </main>
    `;
}
