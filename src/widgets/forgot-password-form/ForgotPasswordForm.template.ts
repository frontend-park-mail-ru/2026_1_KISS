import { escapeHtml } from '../../shared/utils/escapeHtml.js';

/**
 * Рендерит форму запроса сброса пароля: заголовок, контейнер для поля email,
 * кнопка отправки, ссылка возврата к логину и место для серверной ошибки.
 * @param ctx - заголовок формы и опциональная ошибка
 * @returns HTML-разметка для innerHTML
 */
export function ForgotPasswordTemplate(ctx: { title: string; error?: string }): string {
    return `<form class="forgot-password-form">
    <h2 class="form-title">${escapeHtml(ctx.title)}</h2>
    <p class="forgot-password-form__hint">Введите email вашего аккаунта — мы пришлём ссылку для сброса пароля.</p>

    <div class="form-fields">
    </div>

    <button type="submit" class="accent-btn" id="forgot-password-btn">Отправить ссылку</button>
    <a class="simple-btn" href="" id="back-to-login-btn">Вернуться ко входу</a>
    <span class="sign-error-message">${escapeHtml(ctx.error ?? '')}</span>
</form>`;
}
