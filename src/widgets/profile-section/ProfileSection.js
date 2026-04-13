import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { ProfileSectionTemplate } from './ProfileSection.template.js';

/**
 * ProfileSection displays the user's profile info with avatar upload,
 * editable fields, and email change functionality.
 * @extends BaseComponent
 */
export class ProfileSection extends BaseComponent {
    #config;
    #httpClient;
    #usernameInput;

    /**
     * @param {HTMLElement} parent - container element
     * @param {object} config - section configuration
     * @param {object} config.user - current user data
     * @param {Function} config.onUserUpdate - called with updated user object
     */
    constructor(parent, config) {
        super(null, parent);
        this.#config = config;
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    /**
     * Renders the profile section from Handlebars template.
     */
    #render() {
        const user = this.#config.user;
        const createdAt = new Date(user.created_at).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const initials = user.username.substring(0, 2).toUpperCase();
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = ProfileSectionTemplate({ user, createdAt, initials });
        this._element = tempContainer.firstElementChild;
    }

    /**
     * Mounts the component and attaches all event handlers.
     */
    mount() {
        if (this._isMounted) return;
        super.mount();

        const usernameWrap = this._element.querySelector('.profile-section__username-wrap');
        this.#usernameInput = new Input(usernameWrap, {
            ...TYPE_INPUT_CONFIG.LOGIN,
            id: `profile-username-${Date.now()}`,
            placeholder: 'Имя пользователя'
        });
        this.#usernameInput.mount();
        const inputEl = usernameWrap.querySelector('.input-field');
        if (inputEl) {
            inputEl.value = this.#config.user.username;
        }

        this.#attachAvatarEvents();
        this.#attachSaveEvents();
        this.#attachEmailEvents();
    }

    /**
     * Unmounts the component and cleans up child widgets.
     */
    unmount() {
        if (!this._isMounted) return;
        if (this.#usernameInput) {
            this.#usernameInput.unmount();
        }
        super.unmount();
    }

    /**
     * Attaches avatar upload button and file input events.
     */
    #attachAvatarEvents() {
        const fileInput = this._element.querySelector('.profile-section__file-input');
        const uploadBtn = this._element.querySelector('.profile-section__upload-btn');
        const errorEl = this._element.querySelector('.profile-section__upload-error');

        this._addListener(uploadBtn, 'click', () => fileInput.click());

        this._addListener(fileInput, 'change', () => {
            const file = fileInput.files[0];
            if (!file) return;

            errorEl.textContent = '';
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();

            img.onload = async () => {
                URL.revokeObjectURL(objectUrl);

                if (img.width !== img.height) {
                    errorEl.textContent = 'Изображение должно быть квадратным (1:1)';
                    fileInput.value = '';
                    return;
                }

                try {
                    const response = await this.#httpClient.upload('/users/me/avatar', file);
                    const result = await response.json();

                    if (!response.ok) {
                        errorEl.textContent = translateError(result.error);
                        return;
                    }

                    this.#config.user = result.data;
                    if (this.#config.onUserUpdate) {
                        this.#config.onUserUpdate(result.data);
                    }

                    const avatarEl = this._element.querySelector('.profile-section__avatar');
                    avatarEl.innerHTML = '';
                    const img = document.createElement('img');
                    img.className = 'profile-section__avatar-img';
                    img.src = result.data.avatar_url;
                    img.alt = 'Avatar';
                    avatarEl.appendChild(img);
                } catch (_e) {
                    errorEl.textContent = 'Ошибка загрузки файла';
                }

                fileInput.value = '';
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                errorEl.textContent = 'Не удалось прочитать изображение';
                fileInput.value = '';
            };

            img.src = objectUrl;
        });
    }

    /**
     * Attaches profile save button events.
     */
    #attachSaveEvents() {
        const saveBtn = this._element.querySelector('.profile-section__save-btn');
        const msgEl = this._element.querySelector('.profile-section__save-msg');

        this._addListener(saveBtn, 'click', async () => {
            if (!this.#usernameInput.validate()) return;

            const username = this.#usernameInput.getValue();
            const status = this._element.querySelector('[data-field="status"]').value;
            const description = this._element.querySelector('[data-field="description"]').value;

            msgEl.textContent = '';
            msgEl.className = 'profile-section__save-msg';

            try {
                const response = await this.#httpClient.put('/users/me', {
                    username,
                    status,
                    description
                });
                const result = await response.json();

                if (!response.ok) {
                    msgEl.textContent = translateError(result.error);
                    msgEl.classList.add('profile-section__save-msg--error');
                    return;
                }

                this.#config.user = result.data;
                if (this.#config.onUserUpdate) {
                    this.#config.onUserUpdate(result.data);
                }
                msgEl.textContent = 'Профиль обновлен';
                msgEl.classList.add('profile-section__save-msg--success');
            } catch (_e) {
                msgEl.textContent = 'Ошибка сохранения';
                msgEl.classList.add('profile-section__save-msg--error');
            }
        });
    }

    /**
     * Attaches email change form toggle and submit events.
     */
    #attachEmailEvents() {
        const changeBtn = this._element.querySelector('.profile-section__email-change-btn');
        const emailForm = this._element.querySelector('.profile-section__email-form');
        const emailSaveBtn = this._element.querySelector('.profile-section__email-save-btn');
        const emailMsg = this._element.querySelector('.profile-section__email-msg');

        const passwordWrap = this._element.querySelector('.profile-section__email-password-wrap');
        const passwordInput = new Input(passwordWrap, {
            ...TYPE_INPUT_CONFIG.PASSWORD,
            id: `email-password-${Date.now()}`,
            placeholder: 'Текущий пароль'
        });

        this._addListener(changeBtn, 'click', () => {
            emailForm.classList.toggle('profile-section__email-form--hidden');
            const isHidden = emailForm.classList.contains('profile-section__email-form--hidden');
            changeBtn.textContent = isHidden ? 'Изменить email' : 'Отмена';
            if (!isHidden) {
                passwordInput.mount();
                passwordInput.clear();
                const pwdEl = passwordWrap.querySelector('.input-field');
                if (pwdEl) pwdEl.setAttribute('autocomplete', 'new-password');
            } else {
                passwordInput.unmount();
            }
        });

        this._addListener(emailSaveBtn, 'click', async () => {
            const newEmailInput = this._element.querySelector('[data-field="new_email"]');
            const newEmail = newEmailInput.value;
            const password = passwordInput.getValue();

            emailMsg.textContent = '';

            if (!newEmail) {
                emailMsg.textContent = 'Введите email';
                emailMsg.style.color = 'var(--error-red)';
                return;
            }
            if (!password) {
                emailMsg.textContent = 'Введите пароль';
                emailMsg.style.color = 'var(--error-red)';
                return;
            }

            try {
                const response = await this.#httpClient.put('/users/me/email', {
                    new_email: newEmail,
                    password
                });
                const result = await response.json();

                if (!response.ok) {
                    emailMsg.textContent = translateError(result.error);
                    emailMsg.style.color = 'var(--error-red)';
                    return;
                }

                this.#config.user = result.data;
                if (this.#config.onUserUpdate) {
                    this.#config.onUserUpdate(result.data);
                }

                const currentEl = this._element.querySelector('.profile-section__email-current');
                currentEl.textContent = result.data.email;
                emailForm.classList.add('profile-section__email-form--hidden');
                passwordInput.unmount();
                emailMsg.textContent = 'Email обновлен';
                emailMsg.style.color = 'var(--teal-green)';
            } catch (_e) {
                emailMsg.textContent = 'Ошибка смены email';
                emailMsg.style.color = 'var(--error-red)';
            }
        });
    }
}
