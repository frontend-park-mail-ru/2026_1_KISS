import { escapeHtml } from '../../shared/utils/escapeHtml.js';

/**
 * Рендерит форму установки нового пароля: заголовок, контейнер для полей
 * password/repeat_password, кнопка подтверждения и место для ошибки.
 * @param ctx - заголовок формы и опциональная ошибка
 * @returns HTML-разметка для innerHTML
 */
export function ResetPasswordTemplate(ctx: { title: string; error?: string }): string {
    return `<form class="reset-password-form">
    <h2 class="form-title">${escapeHtml(ctx.title)}</h2>

    <div class="form-fields">
    </div>

    <button type="submit" class="accent-btn" id="reset-password-btn">Сохранить пароль</button>
    <a class="simple-btn" href="" id="back-to-login-btn">Войти</a>
    <span class="sign-error-message">${escapeHtml(ctx.error ?? '')}</span>
</form>`;
}
