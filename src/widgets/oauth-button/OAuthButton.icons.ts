/**
 * Inline SVG-иконки трёх OAuth-провайдеров. Цвета зашиты внутри SVG, так как
 * по гайдлайнам провайдеров (Google, Yandex, VK ID) логотип должен быть в
 * фирменном цвете и не масштабируется по теме приложения.
 */
export const OAUTH_ICONS = {
    google: `<svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.4 6.3 14.1z"/><path fill="#4CAF50" d="M24 44c5 0 9.5-1.9 12.9-5.1l-6-5.1c-2 1.4-4.4 2.2-6.9 2.2-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.1 4.1-3.9 5.6l6 5.1C40.1 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`,
    yandex: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#FC3F1D"/><path d="M13.86 18.6h2.08V5.4h-3.5c-3.46 0-5.32 1.75-5.32 4.4 0 2.1 1.01 3.33 2.8 4.6l-3.1 4.2h2.52l3.72-6.4-1.15-.78c-1.46-1-2.18-1.74-2.18-3.4 0-1.42 1-2.4 2.9-2.4h.85z" fill="#FFFFFF"/></svg>`,
    vkid: `<svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#0077FF"/><path d="M25.6 34.4c-9 0-14.4-6.2-14.6-16.6h4.6c.1 7.6 3.4 10.8 6 11.5V17.8h4.3v6.7c2.6-.3 5.3-3.3 6.2-6.7h4.3c-.7 4.1-3.5 7.1-5.6 8.4 2.1 1 5.3 3.6 6.6 8.2h-4.8c-1-3.1-3.5-5.5-6.7-5.9v5.9z" fill="#FFFFFF"/></svg>`
} as const;

/**
 * Имя поддерживаемого OAuth-провайдера. Совпадает с ключом в `OAUTH_ICONS`
 * и с path-параметром `{provider}` на бэкенд-эндпоинте
 * `/api/v1/auth/oauth/{provider}/start`.
 */
export type OAuthProviderName = keyof typeof OAUTH_ICONS;

/**
 * Подписи провайдеров для модалки выбора сервиса. Короткие — только название,
 * без префикса «Войти через», так как заголовок модалки уже задаёт контекст.
 */
export const OAUTH_PROVIDER_LABELS: Record<OAuthProviderName, string> = {
    google: 'Google',
    yandex: 'Яндекс',
    vkid: 'VK ID'
};
