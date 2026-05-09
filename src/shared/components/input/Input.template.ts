import { escapeHtml } from '../../utils/escapeHtml.js';

export function InputTemplate(ctx: {
    type: string;
    id: string;
    value?: string;
    placeholder: string;
    required?: boolean;
    pattern?: string | null;
    minlength?: number | null;
    maxlength?: number | null;
    error?: string;
    disabled?: boolean;
    isPassword?: boolean;
}): string {
    return `<div class="input-wrapper ${ctx.error ? 'input-wrapper_error' : ''} ${ctx.disabled ? 'input-wrapper_disabled' : ''}">
    <div class="input-field-container">
        <input
                type="${escapeHtml(ctx.type)}"
                id="${escapeHtml(ctx.id)}"
                value="${escapeHtml(ctx.value)}"
                placeholder="${escapeHtml(ctx.placeholder)}"
                class="input-field"
            ${ctx.required ? 'required' : ''}
            ${ctx.pattern ? `pattern="${escapeHtml(ctx.pattern)}"` : ''}
            ${ctx.minlength ? `minlength="${escapeHtml(ctx.minlength)}"` : ''}
            ${ctx.maxlength ? `maxlength="${escapeHtml(ctx.maxlength)}"` : ''}
        />
        ${
            ctx.isPassword
                ? `<button type="button" class="toggle-password-btn" aria-label="Показать пароль">
                <img class="eye-icon eye-icon_closed" src="/images/eye-closed.svg" alt="Показать пароль"/>
                <img class="eye-icon eye-icon_open eye-icon_hidden" src="/images/eye-open.svg" alt="Скрыть пароль"/>
            </button>`
                : ''
        }
    </div>

    <span class="input-error-message">${escapeHtml(ctx.error)}</span>

</div>`;
}
