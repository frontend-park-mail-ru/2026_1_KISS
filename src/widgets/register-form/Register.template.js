import { escapeHtml } from '../../shared/utils/escapeHtml.js';

export function RegisterTemplate(ctx) {
    return `<form class="registration-form">
    <h2 class="form-title">${escapeHtml(ctx.title)}</h2>

    <div class="form-fields">
    </div>

    <button type="submit" class="accent-btn" id="register-btn">Зарегистрироваться</button>
    <a class="simple-btn" href="" id="go-out-btn">Войти</a>
    <span class="sign-error-message">${escapeHtml(ctx.error)}</span>
</form>`;
}
