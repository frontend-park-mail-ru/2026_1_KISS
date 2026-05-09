import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { LoginTemplate } from './Login.template.js';
import { nn } from '../../shared/utils/notNull.js';

const FIELD_NAMES = {
    email: 'email',
    password: 'password'
} as const;

/**
 * Форма логина: два поля Input (email + пароль), кнопка отправки, переход на
 * регистрацию. На submit POST /auth/login; при успехе — navigate('/files'),
 * при 4xx — показывает translateError, при network-ошибке — "Сервер недоступен".
 */
export class Login extends BaseComponent {
    #inputs: Input[] = [];
    #httpClient: HttpClient;

    /**
     * Создаёт форму, рендерит шаблон и подготавливает поля.
     * @param parent - родительский элемент
     */
    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер и создаёт Input-компоненты.
     */
    #render(): void {
        const data = {
            title: 'Вход'
        };
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = LoginTemplate(data);
        this._element = tempContainer.firstElementChild as HTMLElement;
        this.#createInputs();
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
        this.#attachEvents();
    }

    /**
     * Снимает с DOM (включая Input'ы).
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
        this.#inputs.forEach((input) => {
            input.unmount();
        });
    }

    /**
     * Сбрасывает значения всех Input'ов. Вызывается после успешного логина или
     * при переключении формы.
     */
    public update(): void {
        this.#inputs.forEach((input) => {
            input.update();
        });
    }

    /**
     * Создаёт Input-компоненты для email и password по конфигурации TYPE_INPUT_CONFIG
     * и монтирует их в .form-fields. Сохраняет ссылки в #inputs для последующего
     * mount/getValue/validate.
     */
    #createInputs(): void {
        const fieldsContainer = nn(this._element.querySelector('.form-fields'));
        const fieldsConfig = [
            { name: FIELD_NAMES.email, type: TYPE_INPUT_CONFIG.EMAIL },
            { name: FIELD_NAMES.password, type: TYPE_INPUT_CONFIG.PASSWORD }
        ];

        fieldsConfig.forEach((field) => {
            const fieldContainer = document.createElement('div');
            fieldContainer.className = 'form-field';
            fieldContainer.dataset.field = field.name;
            fieldsContainer.appendChild(fieldContainer);

            const input = new Input(fieldContainer, field.type);
            this.#inputs.push(input);
        });
    }

    /**
     * Навешивает submit-обработчик на кнопку (предотвращает дефолтный submit
     * формы, вызывает асинхронный #submit).
     */
    #attachEvents(): void {
        const btn = nn(this._element.querySelector('#login-btn'));
        this._addListener(btn, 'click', (e: Event) => {
            e.preventDefault();
            void this.#submit();
        });
    }

    /**
     * Валидирует поля, отправляет POST /auth/login. При успехе — navigate('/files'),
     * при ошибке — показывает translateError или "Сервер недоступен".
     */
    async #submit(): Promise<void> {
        nn(this._element.querySelector('.sign-error-message')).textContent = '';
        if (!this.validateFields()) return;

        const formData = {
            email: this.#inputs[0].getValue(),
            password: this.#inputs[1].getValue()
        };

        try {
            const response = await this.#httpClient.post('/auth/login', formData);
            if (!response.ok) {
                let data: Record<string, unknown>;
                try {
                    data = (await response.json()) as Record<string, unknown>;
                } catch (_e) {
                    data = {};
                }
                const errorElement = this._element.querySelector('.sign-error-message');
                if (errorElement) {
                    errorElement.textContent = translateError(data.error as string);
                }
                return;
            }
            nn(Router.getInstance()).navigate('/files');
        } catch (_e) {
            this.#inputs[0].showError('Сервер недоступен');
        }
    }

    /**
     * Прогоняет валидацию каждого Input'а; возвращает true только если все валидны.
     * @returns true если форма валидна целиком
     */
    public validateFields(): boolean {
        let allValid = true;
        this.#inputs.forEach((input) => {
            if (!input.validate()) {
                allValid = false;
            }
        });
        return allValid;
    }

    /**
     * Геттер ссылки на регистрацию — родительская страница вешает на неё
     * обработчик переключения формы.
     * @returns DOM-элемент ссылки или null если форма не отрендерена
     */
    public get goToRegisterBtn(): HTMLElement | null {
        return this._element.querySelector('#register-from-login-btn');
    }
}
