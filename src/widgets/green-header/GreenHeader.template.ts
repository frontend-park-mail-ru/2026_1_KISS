import { escapeHtml } from '../../shared/utils/escapeHtml.js';

interface HeaderButton {
    text: string;
    class: string;
    action: string;
}

interface GreenHeaderTemplateCtx {
    logo: string;
    user?: {
        avatarUrl?: string;
        initials: string;
        username: string;
    };
    onAdmin?: unknown;
    buttons?: HeaderButton[];
}

export function GreenHeaderTemplate(ctx: GreenHeaderTemplateCtx): string {
    return `<header class="green-header">
    <div class="header-container">
        <a href="/" class="logo-link">
            <img src="${escapeHtml(ctx.logo)}" alt="Logo" class="logo-image">
        </a>

        ${
            ctx.user
                ? `<div class="header-user-pill-wrapper">
            <div class="header-user-pill">
                ${Boolean(ctx.user.avatarUrl) ? `<img class="header-user-pill__avatar" src="${escapeHtml(ctx.user.avatarUrl)}" alt="" />` : `<span class="header-user-pill__avatar header-user-pill__avatar--default">${escapeHtml(ctx.user.initials)}</span>`}
                <span class="header-user-pill__name">${escapeHtml(ctx.user.username)}</span>
            </div>
            <div class="header-user-dropdown">
                <button class="header-user-dropdown__item" data-action="profile">Профиль</button>
                ${Boolean(ctx.onAdmin) ? '<button class="header-user-dropdown__item" data-action="admin">Админ-панель</button>' : ''}
                <button class="header-user-dropdown__item" data-action="feedback">Обратная связь</button>
                <button class="header-user-dropdown__item header-user-dropdown__item--danger" data-action="logout">Выйти из аккаунта</button>
            </div>
        </div>`
                : `<div class="header-buttons">
            ${(ctx.buttons ?? [])
                .map(
                    (
                        item
                    ) => `<button class="base-btn  ${escapeHtml(item.class)}" data-action="${escapeHtml(item.action)}">
                    ${escapeHtml(item.text)}
                </button>`
                )
                .join('\n                ')}
        </div>`
        }
    </div>
</header>`;
}
