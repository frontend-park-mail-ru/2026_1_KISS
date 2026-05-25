import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { ResetPasswordTemplate } from './ResetPasswordForm.template.js';
import { nn } from '../../shared/utils/notNull.js';
import { logError } from '../../shared/utils/logger.js';

/**
 * Форма установки нового пароля: два поля (password + repeat_password).
 * Читает токен из query-параметра URL `?token=`. После валидации делает
 * POST /auth/reset-password; при успехе перенаправляет на /login с баннером.
 */
export class ResetPasswordForm extends BaseComponent {
    #inputs: Input[] = [];
    #httpClient: HttpClient;
    #token: string;

    /**
     * Создаёт форму, читает токен из URL и рендерит поля.
     * @param parent - родительский элемент
     */
    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#httpClient = HttpClient.getInstance();
        this.#token = new URLSearchParams(window.location.search).get('token') ?? '';
        this.#render();
    }

    /**
     * Рендерит шаблон и создаёт два Input-компонента (password/repeat_password).
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = ResetPasswordTemplate({ title: 'Новый пароль' });
        this._element = tempContainer.firstElementChild as HTMLElement;

        if (!this.#token) {
            this.#showInvalidToken();
            return;
        }

        this.#createInputs();
    }

    /**
     * Создаёт два Input-компонента — пароль и подтверждение пароля — в .form-fields.
     */
    #createInputs(): void {
        const fieldsContainer = nn(this._element.querySelector('.form-fields'));
        const configs = [
            { name: 'password', type: TYPE_INPUT_CONFIG.PASSWORD },
            { name: 'repeat_password', type: TYPE_INPUT_CONFIG.REPEAT_PASSWORD }
        ];

        configs.forEach((cfg) => {
            const fieldContainer = document.createElement('div');
            fieldContainer.className = 'form-field';
            fieldContainer.dataset.field = cfg.name;
            fieldsContainer.appendChild(fieldContainer);
            this.#inputs.push(new Input(fieldContainer, cfg.type));
        });
    }

    /**
     * Заменяет содержимое формы на сообщение о недействительной ссылке.
     */
    #showInvalidToken(): void {
        this._element.innerHTML = `
            <div class="email-sent">
                <h2 class="email-sent__title">Ссылка недействительна</h2>
                <p class="email-sent__text">Эта ссылка для сброса пароля устарела или уже была использована.</p>
                <a class="simple-btn email-sent__btn" href="" id="back-to-login-btn">Войти</a>
            </div>`;
    }

    /**
     * Маунтит форму и все Input'ы, навешивает submit-обработчик.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#inputs.forEach((input) => {
            input.mount();
        });
        if (this.#token) {
            this.#attachEvents();
        }
    }

    /**
     * Снимает форму и все Input'ы с DOM.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
        this.#inputs.forEach((input) => {
            input.unmount();
        });
    }

    /**
     * Сбрасывает значения полей.
     */
    public update(): void {
        this.#inputs.forEach((input) => {
            input.update();
        });
    }

    /**
     * Навешивает submit-обработчик на кнопку.
     */
    #attachEvents(): void {
        const btn = nn(this._element.querySelector('#reset-password-btn'));
        this._addListener(btn, 'click', (e: Event) => {
            e.preventDefault();
            void this.#submit();
        });
    }

    /**
     * Валидирует поля (включая совпадение паролей), отправляет
     * POST /auth/reset-password. При успехе навигирует на /login?reset=1.
     * При ошибке показывает translateError.
     */
    async #submit(): Promise<void> {
        nn(this._element.querySelector('.sign-error-message')).textContent = '';

        let allValid = true;
        this.#inputs.forEach((input) => {
            if (!input.validate()) allValid = false;
        });
        if (this.#inputs[0].getValue() !== this.#inputs[1].getValue()) {
            allValid = false;
            this.#inputs[1].showError('Пароли не совпадают');
        }
        if (!allValid) return;

        const response = await this.#httpClient.post('/auth/reset-password', {
            token: this.#token,
            new_password: this.#inputs[0].getValue()
        });

        let responseData: Record<string, unknown>;
        try {
            responseData = (await response.json()) as Record<string, unknown>;
        } catch (_e) {
            responseData = {};
        }

        if (!response.ok) {
            logError(responseData);
            const errorElement = this._element.querySelector('.sign-error-message');
            if (errorElement) {
                errorElement.textContent = translateError(responseData.error as string);
            }
            return;
        }

        nn(Router.getInstance()).navigate('/login?reset=1');
    }

    /**
     * Геттер ссылки "Войти" — родительская страница может вешать на неё обработчик.
     * @returns DOM-элемент ссылки или null
     */
    public get backToLoginBtn(): HTMLElement | null {
        return this._element.querySelector('#back-to-login-btn');
    }
}
