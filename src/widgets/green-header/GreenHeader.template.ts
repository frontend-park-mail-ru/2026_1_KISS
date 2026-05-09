import { escapeHtml } from '../../shared/utils/escapeHtml.js';

/**
 * Кнопка в правой части шапки для гостевых страниц (Войти/Регистрация).
 */
interface HeaderButton {
    /** Текст кнопки */
    text: string;
    /** Дополнительный CSS-класс */
    class: string;
    /** Идентификатор действия (попадает в data-action) */
    action: string;
}

/**
 * Контекст шаблона шапки. Если задан user — показывается user-pill с dropdown'ом,
 * иначе — массив buttons (для гостей: Войти/Регистрация).
 */
interface GreenHeaderTemplateCtx {
    /** Путь к логотипу */
    logo: string;
    /** Данные текущего пользователя (для авторизованных) */
    user?: {
        /** URL аватара */
        avatarUrl?: string;
        /** Инициалы для дефолтного аватара */
        initials: string;
        /** Логин для отображения */
        username: string;
    };
    /** Не-undefined если пользователь — админ (показывает пункт "Админ-панель") */
    onAdmin?: unknown;
    /** Кнопки для гостей */
    buttons?: HeaderButton[];
}

/**
 * Рендерит зелёную шапку приложения. Для авторизованных пользователей показывает
 * user-pill с dropdown (Профиль/Админка/Обратная связь/Выйти), для гостей —
 * набор кнопок переданных через ctx.buttons.
 * @param ctx - контекст шаблона (логотип, пользователь или кнопки)
 * @returns HTML-разметка для innerHTML
 */
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
                ${(ctx.user.avatarUrl ?? '') !== '' ? `<img class="header-user-pill__avatar" src="${escapeHtml(ctx.user.avatarUrl)}" alt="" />` : `<span class="header-user-pill__avatar header-user-pill__avatar--default">${escapeHtml(ctx.user.initials)}</span>`}
                <span class="header-user-pill__name">${escapeHtml(ctx.user.username)}</span>
            </div>
            <div class="header-user-dropdown">
                <button class="header-user-dropdown__item" data-action="profile">Профиль</button>
                ${ctx.onAdmin !== undefined && ctx.onAdmin !== null ? '<button class="header-user-dropdown__item" data-action="admin">Админ-панель</button>' : ''}
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
