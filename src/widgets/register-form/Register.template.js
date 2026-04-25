import { escapeHtml } from '../../shared/utils/escapeHtml.js';

export function RegisterTemplate(ctx) {
    return `
        <div class="register-form-container">
            <form class="register-form">
                <h2 class="form-title">${escapeHtml(ctx.title)}</h2>
                
                <div class="form-fields">
                </div>
                
                <div class="sign-error-message" style="color: var(--error-red); font-size: 14px; margin-top: 8px; min-height: 40px;">
                    ${ctx.error ? escapeHtml(ctx.error) : ''}
                </div>
                
                <button type="submit" class="accent-btn" id="register-btn">Зарегистрироваться</button>
                
                <div class="form-footer">
                    <a class="simple-btn" href="#" id="login-from-register-btn">Войти</a>
                </div>
            </form>
        </div>
    `;
}