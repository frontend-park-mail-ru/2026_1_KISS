import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { OAUTH_ICONS } from '../oauth-button/OAuthButton.icons.js';

/**
 * Рендерит форму логина: заголовок, контейнер для динамически добавляемых Input'ов,
 * кнопки "Войти"/"Зарегистрироваться" и место для серверной ошибки.
 * @param ctx - заголовок формы и опциональная ошибка от сервера
 * @returns HTML-разметка для innerHTML
 */
export function LoginTemplate(ctx: { title: string; error?: string }): string {
    return `<form class="login-form">
    <h2 class="form-title">${escapeHtml(ctx.title)}</h2>

    <div class="form-fields">
    </div>

    <button type="submit" class="accent-btn" id="login-btn">Войти</button>
    <a class="simple-btn" href="" id="register-from-login-btn">Зарегистрироваться</a>
    <a class="login-form__forgot-link" href="" id="forgot-password-link-btn">Забыли пароль?</a>
    <span class="sign-error-message">${escapeHtml(ctx.error ?? '')}</span>

    <button type="button" class="oauth-toggle-btn" id="oauth-open-modal-btn">
        <span class="oauth-toggle-btn__label">Войти с помощью</span>
        <span class="oauth-toggle-btn__icons">
            <span class="oauth-toggle-btn__icon-preview">${OAUTH_ICONS.google}</span>
            <span class="oauth-toggle-btn__icon-preview">${OAUTH_ICONS.yandex}</span>
            <span class="oauth-toggle-btn__icon-preview">${OAUTH_ICONS.vkid}</span>
        </span>
    </button>
</form>`;
}
