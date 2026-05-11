/**
 * Шаблон модалки выбора OAuth-провайдера: затемнённый overlay поверх страницы,
 * центральная карточка с заголовком, кнопкой закрытия и контейнером, в который
 * OAuthModal монтирует виджеты OAuthButton.
 * @returns HTML-разметка для innerHTML
 */
export function OAuthModalTemplate(): string {
    return `<div class="oauth-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="oauth-modal-title">
    <div class="oauth-modal">
        <button type="button" class="oauth-modal__close" aria-label="Закрыть">×</button>
        <h2 class="oauth-modal__title" id="oauth-modal-title">Выберите сервис для входа</h2>
        <div class="oauth-providers-list" id="oauth-modal-providers"></div>
    </div>
</div>`;
}
