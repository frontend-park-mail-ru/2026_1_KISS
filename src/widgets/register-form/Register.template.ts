import { escapeHtml } from '../../shared/utils/escapeHtml.js';

/**
 * Рендерит форму регистрации: заголовок, контейнер для динамически добавляемых
 * Input'ов, кнопки "Зарегистрироваться"/"Войти" и место для серверной ошибки.
 * @param ctx - заголовок формы и опциональная ошибка от сервера
 * @returns HTML-разметка для innerHTML
 */
export function RegisterTemplate(ctx: { title: string; error?: string }): string {
    return `<form class="registration-form">
    <h2 class="form-title">${escapeHtml(ctx.title)}</h2>

    <div class="form-fields">
    </div>

    <button type="submit" class="accent-btn" id="register-btn">Зарегистрироваться</button>
    <a class="simple-btn" href="" id="go-out-btn">Войти</a>
    <span class="sign-error-message">${escapeHtml(ctx.error ?? '')}</span>
</form>`;
}
