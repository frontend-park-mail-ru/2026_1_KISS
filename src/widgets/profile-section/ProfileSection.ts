import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { ProfileSectionTemplate } from './ProfileSection.template.js';
import { nn } from '../../shared/utils/notNull.js';
import type { ApiEnvelope, UserDTO } from '../../shared/api/types.js';

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

    public constructor(parent: HTMLElement, config: ProfileSectionConfig) {
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

    public mount(): void {
        if (this._isMounted) return;
        super.mount();

        const usernameWrap = nn(
            this._element.querySelector<HTMLElement>('.profile-section__username-wrap')
        );
        this.#usernameInput = new Input(usernameWrap, {
            ...TYPE_INPUT_CONFIG.LOGIN,
            id: `profile-username-${String(Date.now())}`,
            placeholder: 'Имя пользователя'
        });
        this.#usernameInput.mount();
        const inputEl = usernameWrap.querySelector<HTMLInputElement>('.input-field');
        if (inputEl) {
            inputEl.value = this.#config.user.username;
        }

        this.#attachAvatarEvents();
        this.#attachSaveEvents();
        this.#attachEmailEvents();
    }

    public unmount(): void {
        if (!this._isMounted) return;
        this.#usernameInput.unmount();
        super.unmount();
    }

    #attachAvatarEvents(): void {
        const fileInput = nn(
            this._element.querySelector<HTMLInputElement>('.profile-section__file-input')
        );
        const uploadBtn = nn(this._element.querySelector('.profile-section__upload-btn'));
        const errorEl = nn(this._element.querySelector('.profile-section__upload-error'));

        this._addListener(uploadBtn, 'click', () => {
            fileInput.click();
        });

        this._addListener(fileInput, 'change', () => {
            const files = nn(fileInput.files);
            const file = files[0];
            if (!file) return;

            errorEl.textContent = '';
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();

            img.onload = async (): Promise<void> => {
                URL.revokeObjectURL(objectUrl);

                try {
                    const response = await this.#httpClient.upload('/users/me/avatar', file);
                    const result = (await response.json()) as Partial<ApiEnvelope<UserDTO>>;

                    if (!response.ok) {
                        errorEl.textContent = translateError(result.error);
                        return;
                    }

                    const updated = result.data as UserDTO;
                    this.#config.user = updated as unknown as ProfileUser;
                    if (this.#config.onUserUpdate) {
                        this.#config.onUserUpdate(updated as unknown as ProfileUser);
                    }

                    const avatarEl = nn(this._element.querySelector('.profile-section__avatar'));
                    avatarEl.innerHTML = '';
                    const imgEl = document.createElement('img');
                    imgEl.className = 'profile-section__avatar-img';
                    imgEl.src = updated.avatar_url;
                    imgEl.alt = 'Avatar';
                    avatarEl.appendChild(imgEl);
                } catch (_e) {
                    errorEl.textContent = 'Ошибка загрузки файла';
                }

                fileInput.value = '';
            };

            img.onerror = (): void => {
                URL.revokeObjectURL(objectUrl);
                errorEl.textContent = 'Не удалось прочитать изображение';
                fileInput.value = '';
            };

            img.src = objectUrl;
        });
    }

    #attachSaveEvents(): void {
        const saveBtn = nn(this._element.querySelector('.profile-section__save-btn'));
        const msgEl = nn(this._element.querySelector('.profile-section__save-msg'));

        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async event handler
        this._addListener(saveBtn, 'click', async () => {
            if (!this.#usernameInput.validate()) return;

            const username = this.#usernameInput.getValue();
            const status = nn(
                this._element.querySelector<HTMLInputElement>('[data-field="status"]')
            ).value;
            const description = nn(
                this._element.querySelector<HTMLInputElement>('[data-field="description"]')
            ).value;

            msgEl.textContent = '';
            msgEl.className = 'profile-section__save-msg';

            try {
                const response = await this.#httpClient.put('/users/me', {
                    username,
                    status,
                    description
                });
                const result = (await response.json()) as Partial<ApiEnvelope<UserDTO>>;

                if (!response.ok) {
                    msgEl.textContent = translateError(result.error);
                    msgEl.classList.add('profile-section__save-msg--error');
                    return;
                }

                const updated = result.data as UserDTO;
                this.#config.user = updated as unknown as ProfileUser;
                if (this.#config.onUserUpdate) {
                    this.#config.onUserUpdate(updated as unknown as ProfileUser);
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
        const changeBtn = nn(this._element.querySelector('.profile-section__email-change-btn'));
        const emailForm = nn(this._element.querySelector('.profile-section__email-form'));
        const emailSaveBtn = nn(this._element.querySelector('.profile-section__email-save-btn'));
        const emailMsg = nn(
            this._element.querySelector<HTMLElement>('.profile-section__email-msg')
        );

        const passwordWrap = nn(
            this._element.querySelector<HTMLElement>('.profile-section__email-password-wrap')
        );
        const passwordInput = new Input(passwordWrap, {
            ...TYPE_INPUT_CONFIG.PASSWORD,
            id: `email-password-${String(Date.now())}`,
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

        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async event handler
        this._addListener(emailSaveBtn, 'click', async () => {
            const newEmailInput = nn(
                this._element.querySelector<HTMLInputElement>('[data-field="new_email"]')
            );
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
                const result = (await response.json()) as Partial<ApiEnvelope<UserDTO>>;

                if (!response.ok) {
                    emailMsg.textContent = translateError(result.error);
                    emailMsg.style.color = 'var(--error-red)';
                    return;
                }

                const updated = result.data as UserDTO;
                this.#config.user = updated as unknown as ProfileUser;
                if (this.#config.onUserUpdate) {
                    this.#config.onUserUpdate(updated as unknown as ProfileUser);
                }

                const currentEl = nn(
                    this._element.querySelector('.profile-section__email-current')
                );
                currentEl.textContent = updated.email;
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
