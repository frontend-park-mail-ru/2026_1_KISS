import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { LoginTemplate } from './Login.template.js';

const FIELD_NAMES = {
    email: 'email',
    password: 'password'
} as const;

export class Login extends BaseComponent {
    #inputs: Input[] = [];
    #httpClient: HttpClient;

    constructor(parent: HTMLElement) {
        super(null, parent);
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    #render(): void {
        const data = {
            title: 'Colab'
        };
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = LoginTemplate(data);
        this._element = tempContainer.firstElementChild as HTMLElement;
        this.#createInputs();
    }

    mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#inputs.forEach((input) => {
            input.mount();
        });
        this.#attachEvents();
    }

    unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
        this.#inputs.forEach((input) => {
            input.unmount();
        });
    }

    update(): void {
        this.#inputs.forEach((input) => {
            input.update();
        });
    }

    #createInputs(): void {
        const fieldsContainer = this._element.querySelector('.form-fields') as HTMLElement;
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

    #attachEvents(): void {
        const btn = this._element.querySelector('#login-btn') as HTMLElement;
        this._addListener(btn, 'click', (e: Event) => {
            e.preventDefault();
            this.#submit();
        });
    }

    async #submit(): Promise<void> {
        (this._element.querySelector('.sign-error-message') as HTMLElement).textContent = '';
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
                    data = await response.json();
                } catch (_e) {
                    data = {};
                }
                const errorElement = this._element.querySelector(
                    '.sign-error-message'
                ) as HTMLElement | null;
                if (errorElement) {
                    errorElement.textContent = translateError(data.error as string);
                }
                return;
            }
            Router.getInstance()!.navigate('/files');
        } catch (_e) {
            this.#inputs[0].showError('Сервер недоступен');
        }
    }

    validateFields(): boolean {
        let allValid = true;
        this.#inputs.forEach((input) => {
            if (!input.validate()) {
                allValid = false;
            }
        });
        return allValid;
    }

    get goToRegisterBtn(): HTMLElement | null {
        return this._element.querySelector('#register-from-login-btn');
    }
}
