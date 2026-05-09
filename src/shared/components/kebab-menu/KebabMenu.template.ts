import { escapeHtml } from '../../utils/escapeHtml.js';
import type { KebabAction } from '../../types.js';

export function KebabMenuTemplate(ctx: { actions: KebabAction[] }): string {
    return `<div class="kebab-menu">
    <button class="kebab-menu__trigger">&#8942;</button>
    <div class="kebab-menu__dropdown">
        ${ctx.actions.map((item) => `<button class="kebab-menu__item" data-action="${escapeHtml(item.name)}">${escapeHtml(item.label)}</button>`).join('\n            ')}
    </div>
</div>`;
}
