import { escapeHtml } from '../../shared/utils/escapeHtml.js';

export function ProfileSectionTemplate(ctx) {
    return `<div class="profile-section">
    <h2 class="profile-section__title">Профиль</h2>

    <div class="profile-section__avatar-row">
        <div class="profile-section__avatar">
            ${ctx.user.avatar_url ? `<img class="profile-section__avatar-img" src="${escapeHtml(ctx.user.avatar_url)}" alt="Avatar" />` : `<span class="profile-section__avatar-initials">${escapeHtml(ctx.initials)}</span>`}
        </div>
        <div class="profile-section__avatar-actions">
            <input type="file" class="profile-section__file-input" accept="image/jpeg,image/png,image/bmp" />
            <button class="accent-btn profile-section__upload-btn">Загрузить аватар</button>
            <span class="profile-section__avatar-hint">JPG, PNG или BMP. Макс. 2 МБ. Соотношение сторон аватара должно быть 1 к 1.</span>
        </div>
    </div>

    <div class="profile-section__upload-error"></div>

    <div class="profile-section__form">
        <div class="profile-section__field">
            <label class="profile-section__label">Имя пользователя</label>
            <div class="profile-section__username-wrap"></div>
        </div>

        <div class="profile-section__field">
            <label class="profile-section__label">Статус</label>
            <input type="text" class="profile-section__input" data-field="status" value="${escapeHtml(ctx.user.status)}" maxlength="100" placeholder="Ваш статус" />
        </div>

        <div class="profile-section__field">
            <label class="profile-section__label">О себе</label>
            <textarea class="profile-section__textarea" data-field="description" maxlength="500" placeholder="Расскажите о себе">${escapeHtml(ctx.user.description)}</textarea>
        </div>

        <button class="accent-btn profile-section__save-btn">Сохранить профиль</button>
        <span class="profile-section__save-msg"></span>
    </div>

    <hr class="profile-section__divider" />

    <div class="profile-section__email-section">
        <h3 class="profile-section__subtitle">Email</h3>
        <p class="profile-section__email-current">${escapeHtml(ctx.user.email)}</p>
        <div class="profile-section__email-form profile-section__email-form--hidden">
            <div class="profile-section__field">
                <label class="profile-section__label">Новый email</label>
                <input type="email" class="profile-section__input" data-field="new_email" placeholder="Новый email" />
            </div>
            <div class="profile-section__email-password-wrap"></div>
            <button class="accent-btn profile-section__email-save-btn">Сменить email</button>
            <span class="profile-section__email-msg"></span>
        </div>
        <button class="simple-btn profile-section__email-change-btn">Изменить email</button>
    </div>

    <div class="profile-section__info">
        <span class="profile-section__info-label">Дата регистрации:</span>
        <span class="profile-section__info-value">${escapeHtml(ctx.createdAt)}</span>
    </div>
</div>`;
}
