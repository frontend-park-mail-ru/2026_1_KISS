import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { OAUTH_ICONS, OAUTH_PROVIDER_LABELS, type OAuthProviderName } from './OAuthButton.icons.js';

/**
 * Рендерит кнопку OAuth-входа конкретного провайдера. Иконка — inline SVG
 * из OAUTH_ICONS, текст — из OAUTH_PROVIDER_LABELS. Использует BEM-модификатор
 * `.oauth-btn--<provider>` для применения брендового стиля.
 * @param provider - имя провайдера ('google' | 'yandex' | 'vkid')
 * @returns HTML-разметка для innerHTML
 */
export function OAuthButtonTemplate(provider: OAuthProviderName): string {
    return `<button type="button" class="oauth-btn oauth-btn--${escapeHtml(provider)}">
    <span class="oauth-btn__label">${escapeHtml(OAUTH_PROVIDER_LABELS[provider])}</span>
    <span class="oauth-btn__icon">${OAUTH_ICONS[provider]}</span>
</button>`;
}
