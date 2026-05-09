import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { RegisterTemplate } from './Register.template.js';
import { nn } from '../../shared/utils/notNull.js';

const FIELD_NAMES = {
    login: 'login',
    email: 'email',
    password: 'password',
    repeat_password: 'repeat_password'
} as const;

export class Register extends BaseComponent {
    #inputs: Input[] = [];
    #httpClient: HttpClient;

    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    #render(): void {
        const data = {
            title: 'Регистрация'
        };
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = RegisterTemplate(data);
        this._element = tempContainer.firstElementChild as HTMLElement;

        this.#createInputs();
    }

    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#inputs.forEach((input) => {
            input.mount();
        });
        this.#attachEvents();
    }

    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
        this.#inputs.forEach((input) => {
            input.unmount();
        });
    }

    public update(): void {
        this.#inputs.forEach((input) => {
            input.update();
        });
    }

    #createInputs(): void {
        const fieldsContainer = nn(this._element.querySelector('.form-fields'));
        const fieldsConfig = [
            { name: FIELD_NAMES.login, type: TYPE_INPUT_CONFIG.LOGIN },
            { name: FIELD_NAMES.email, type: TYPE_INPUT_CONFIG.EMAIL },
            { name: FIELD_NAMES.password, type: TYPE_INPUT_CONFIG.PASSWORD },
            { name: FIELD_NAMES.repeat_password, type: TYPE_INPUT_CONFIG.REPEAT_PASSWORD }
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

    #attachEvents(): void {
        const btn = nn(this._element.querySelector('#register-btn'));
        this._addListener(btn, 'click', (e: Event) => {
            e.preventDefault();
            this.#submit();
        });
    }

    async #submit(): Promise<void> {
        (nn(this._element.querySelector('.sign-error-message'))).textContent = '';
        if (!this.validateFields()) return;

        const formData = {
            username: this.#inputs[0].getValue(),
            email: this.#inputs[1].getValue(),
            password: this.#inputs[2].getValue()
        };

        const response = await this.#httpClient.post('/auth/register', formData);
        let responseData: Record<string, unknown>;
        try {
            responseData = await response.json();
        } catch (_e) {
            responseData = { text: await response.text() };
        }

        if (!response.ok) {
            console.error(responseData);
            const errorElement = this._element.querySelector('.sign-error-message');
            if (errorElement) {
                errorElement.textContent = translateError(responseData.error as string);
            }
            return;
        }

        this.#showEmailSent(formData.email);
    }

    #showEmailSent(email: string): void {
        this._element.innerHTML = `
            <div class="email-sent">
                <div class="email-sent__icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--teal-green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="M22 4L12 13L2 4"/>
                    </svg>
                </div>
                <h2 class="email-sent__title">Проверьте почту</h2>
                <p class="email-sent__text">
                    На <strong>${email}</strong> отправлено письмо с ссылкой для подтверждения аккаунта.
                </p>
                <p class="email-sent__hint">Если письмо не пришло, проверьте папку "Спам"</p>
                <a class="simple-btn email-sent__btn" href="" id="go-out-btn">Войти</a>
            </div>`;
    }

    public validateFields(): boolean {
        let allValid = true;
        this.#inputs.forEach((input) => {
            if (!input.validate()) {
                allValid = false;
            }
        });

        if (this.#inputs[2].getValue() !== this.#inputs[3].getValue()) {
            allValid = false;
            this.#inputs[3].showError('Пароли не совпадают');
        }
        return allValid;
    }

    public get goOutBtn(): HTMLElement | null {
        return this._element.querySelector('#go-out-btn');
    }
}
