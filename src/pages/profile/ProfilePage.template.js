export function ProfilePageTemplate() {
    return `<main class="profile-page">
    <div class="profile-page__container">
        <nav class="profile-page__sidebar">
            <div class="profile-page__sidebar-group">
                <h3 class="profile-page__sidebar-title">Аккаунт</h3>
                <button class="profile-page__sidebar-item profile-page__sidebar-item--active" data-section="profile">Профиль</button>
                <button class="profile-page__sidebar-item" data-section="password">Смена пароля</button>
                <button class="profile-page__sidebar-item" data-section="subscription">Подписка</button>
            </div>
            <div class="profile-page__sidebar-group">
                <h3 class="profile-page__sidebar-title">Настройки</h3>
                <button class="profile-page__sidebar-item" data-section="editor">Редактор</button>
            </div>
        </nav>
        <div class="profile-page__content"></div>
    </div>
</main>`;
}
