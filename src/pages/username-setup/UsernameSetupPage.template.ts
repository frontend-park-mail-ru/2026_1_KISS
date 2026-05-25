/**
 * Шаблон страницы обязательного выбора имени пользователя после OAuth-входа,
 * когда внешний провайдер прислал недопустимое имя. Рендерит центрированную
 * карточку с полем ввода, кнопкой сохранения и местом под ошибку.
 * @returns HTML-разметка для innerHTML
 */
export function UsernameSetupPageTemplate(): string {
    return `<main class="sign-page__main">
    <div class="sign-page__container">
        <div class="username-setup-page" role="form" aria-labelledby="username-setup-title">
            <h1 class="username-setup-page__title" id="username-setup-title">Выберите имя пользователя</h1>
            <p class="username-setup-page__hint">Имя из вашего аккаунта не подходит для нашего сервиса. Задайте новое имя пользователя: латиница, цифры и подчёркивание, от 3 до 20 символов.</p>
            <div class="username-setup-page__field"></div>
            <button type="button" class="accent-btn username-setup-page__submit" id="username-setup-submit" disabled>Сохранить</button>
            <span class="sign-error-message username-setup-page__error"></span>
        </div>
    </div>
</main>`;
}
