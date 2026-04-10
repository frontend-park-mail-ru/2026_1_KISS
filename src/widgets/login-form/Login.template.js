import { escapeHtml } from '../../shared/utils/escapeHtml.js';

export function LoginTemplate(ctx) {
    return `<form class="login-form">
    <h2 class="form-title">${escapeHtml(ctx.title)}</h2>

    <div class="form-fields">
    </div>

    <button type="submit" class="accent-btn" id="login-btn">Войти</button>
    <a class="simple-btn" href="" id="register-from-login-btn">Зарегистрироваться</a>
    <span class="sign-error-message">${escapeHtml(ctx.error)}</span>
</form>`;
}
