/**
 * Возвращает разметку контейнера таблицы тарифов. Колонки и строки фич
 * рендерятся динамически из PricingTable, поэтому здесь только обёртка
 * с двумя слотами (заголовки и тело сравнения).
 * @returns строку HTML с двумя пустыми контейнерами data-columns и data-rows
 */
export function PricingTableTemplate(): string {
    return `
        <div class="pricing-table">
            <div class="pricing-table__columns" data-columns></div>
            <div class="pricing-table__rows" data-rows></div>
        </div>
    `;
}
