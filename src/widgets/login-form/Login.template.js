import { escapeHtml } from '../../shared/utils/escapeHtml.js';

export function LoginTemplate(ctx) {
    return `
        <div class="login-form-container">
            <form class="login-form">
                <h2 class="form-title">${escapeHtml(ctx.title)}</h2>
                
                <div class="form-fields">
                </div>
                
                <div class="sign-error-message" style="color: var(--error-red); font-size: 14px; margin-top: 8px; min-height: 40px;">
                    ${ctx.error ? escapeHtml(ctx.error) : ''}
                </div>
                
                <button type="submit" class="accent-btn" id="login-btn">Войти</button>
                
                <div class="form-footer">
                    <a class="simple-btn" href="#" id="register-from-login-btn">Зарегистрироваться</a>
                </div>
            </form>
        </div>
    `;
}
