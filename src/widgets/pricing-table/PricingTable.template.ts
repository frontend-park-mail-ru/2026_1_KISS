/**
 * Возвращает обёртку для PricingTable. Внутри одного table-элемента
 * рендерятся thead (заголовки тарифов с ценой), tbody (строки фич) и
 * tfoot (кнопки CTA) — всё динамически из PricingTable.
 * @returns строку HTML с пустой таблицей и thead/tbody/tfoot
 */
export function PricingTableTemplate(): string {
    return `
        <div class="pricing-table">
            <table class="pricing-table__table">
                <thead data-thead></thead>
                <tbody data-tbody></tbody>
                <tfoot data-tfoot></tfoot>
            </table>
        </div>
    `;
}
