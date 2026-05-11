import { escapeHtml } from '../../shared/utils/escapeHtml.js';

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
    <span class="sign-error-message">${escapeHtml(ctx.error ?? '')}</span>

    <div class="oauth-divider">или</div>
    <div class="oauth-providers" id="login-oauth-providers"></div>
</form>`;
}
