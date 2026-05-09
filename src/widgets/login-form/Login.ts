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

export class Login extends BaseComponent {
    #inputs: Input[] = [];
    #httpClient: HttpClient;

    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    #render(): void {
        const data = {
            title: 'Вход'
        };
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = LoginTemplate(data);
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
        const btn = nn(this._element.querySelector('#login-btn'));
        this._addListener(btn, 'click', (e: Event) => {
            e.preventDefault();
            this.#submit();
        });
    }

    async #submit(): Promise<void> {
        (nn(this._element.querySelector('.sign-error-message'))).textContent = '';
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
                );
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

    public validateFields(): boolean {
        let allValid = true;
        this.#inputs.forEach((input) => {
            if (!input.validate()) {
                allValid = false;
            }
        });
        return allValid;
    }

    public get goToRegisterBtn(): HTMLElement | null {
        return this._element.querySelector('#register-from-login-btn');
    }
}
