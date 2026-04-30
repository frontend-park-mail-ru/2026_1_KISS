import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { ProfileSectionTemplate } from './ProfileSection.template.js';

interface ProfileUser {
    username: string;
    email: string;
    created_at: string;
    avatar_url?: string;
    status: string;
    description: string;
    [key: string]: unknown;
}

interface ProfileSectionConfig {
    user: ProfileUser;
    onUserUpdate?: (user: ProfileUser) => void;
}

export class ProfileSection extends BaseComponent {
    #config: ProfileSectionConfig;
    #httpClient: HttpClient;
    #usernameInput!: Input;

    constructor(parent: HTMLElement, config: ProfileSectionConfig) {
        super(null, parent);
        this.#config = config;
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    #render(): void {
        const user = this.#config.user;
        const createdAt = new Date(user.created_at).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const initials = user.username.substring(0, 2).toUpperCase();
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = ProfileSectionTemplate({ user, createdAt, initials });
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    mount(): void {
        if (this._isMounted) return;
        super.mount();

        const usernameWrap = this._element.querySelector(
            '.profile-section__username-wrap'
        ) as HTMLElement;
        this.#usernameInput = new Input(usernameWrap, {
            ...TYPE_INPUT_CONFIG.LOGIN,
            id: `profile-username-${Date.now()}`,
            placeholder: 'Имя пользователя'
        });
        this.#usernameInput.mount();
        const inputEl = usernameWrap.querySelector('.input-field') as HTMLInputElement | null;
        if (inputEl) {
            inputEl.value = this.#config.user.username;
        }

        this.#attachAvatarEvents();
        this.#attachSaveEvents();
        this.#attachEmailEvents();
    }

    unmount(): void {
        if (!this._isMounted) return;
        if (this.#usernameInput) {
            this.#usernameInput.unmount();
        }
        super.unmount();
    }

    #attachAvatarEvents(): void {
        const fileInput = this._element.querySelector(
            '.profile-section__file-input'
        ) as HTMLInputElement;
        const uploadBtn = this._element.querySelector(
            '.profile-section__upload-btn'
        ) as HTMLElement;
        const errorEl = this._element.querySelector(
            '.profile-section__upload-error'
        ) as HTMLElement;

        this._addListener(uploadBtn, 'click', () => fileInput.click());

        this._addListener(fileInput, 'change', () => {
            const file = fileInput.files![0];
            if (!file) return;

            errorEl.textContent = '';
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();

            img.onload = async () => {
                URL.revokeObjectURL(objectUrl);

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

                    const avatarEl = this._element.querySelector(
                        '.profile-section__avatar'
                    ) as HTMLElement;
                    avatarEl.innerHTML = '';
                    const imgEl = document.createElement('img');
                    imgEl.className = 'profile-section__avatar-img';
                    imgEl.src = result.data.avatar_url;
                    imgEl.alt = 'Avatar';
                    avatarEl.appendChild(imgEl);
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

    #attachSaveEvents(): void {
        const saveBtn = this._element.querySelector('.profile-section__save-btn') as HTMLElement;
        const msgEl = this._element.querySelector('.profile-section__save-msg') as HTMLElement;

        this._addListener(saveBtn, 'click', async () => {
            if (!this.#usernameInput.validate()) return;

            const username = this.#usernameInput.getValue();
            const status = (
                this._element.querySelector('[data-field="status"]') as HTMLInputElement
            ).value;
            const description = (
                this._element.querySelector('[data-field="description"]') as HTMLTextAreaElement
            ).value;

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

    #attachEmailEvents(): void {
        const changeBtn = this._element.querySelector(
            '.profile-section__email-change-btn'
        ) as HTMLElement;
        const emailForm = this._element.querySelector(
            '.profile-section__email-form'
        ) as HTMLElement;
        const emailSaveBtn = this._element.querySelector(
            '.profile-section__email-save-btn'
        ) as HTMLElement;
        const emailMsg = this._element.querySelector('.profile-section__email-msg') as HTMLElement;

        const passwordWrap = this._element.querySelector(
            '.profile-section__email-password-wrap'
        ) as HTMLElement;
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
            const newEmailInput = this._element.querySelector(
                '[data-field="new_email"]'
            ) as HTMLInputElement;
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

            if (newEmail.toLowerCase() === this.#config.user.email.toLowerCase()) {
                emailMsg.textContent = 'Вы уже используете этот email';
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

                const currentEl = this._element.querySelector(
                    '.profile-section__email-current'
                ) as HTMLElement;
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
