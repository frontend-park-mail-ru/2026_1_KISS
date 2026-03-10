import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { translateError } from '../../shared/utils/serverErrors.js';

const FIELD_NAMES = {
    email: 'email',
    password: 'password'
};

export class Login extends BaseComponent {
    #http_client;
    #inputs = [];
    constructor(parent) {
        super(null, parent);
        this.#http_client = new HttpClient();
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['Login'];
        const data = {
            title: 'Colab'
        };
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template(data);
        this._element = tempContainer.firstElementChild;
        this.#createInputs();
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
        this.#inputs.forEach((input) => {
            input.mount();
        });
        this.#attachEvents();
    }

    unmount() {
        if (!this._isMounted) return;
        super.unmount();
        this.#inputs.forEach((input) => {
            input.unmount();
        });
    }

    update() {
        this.#inputs.forEach((input) => {
            input.update();
        });
    }

    #createInputs() {
        const fieldsContainer = this._element.querySelector('.form-fields');
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

    #attachEvents() {
        const btn = this._element.querySelector('#login-btn');
        this._addListener(btn, 'click', (e) => {
            e.preventDefault();
            this.#submit();
        });
    }

    async #submit() {
        if (!this.validateFields()) return;

        const formData = {
            email: this.#inputs[0].getValue(),
            password: this.#inputs[1].getValue()
        };

        try {
            const response = await this.#http_client.post('/auth/login', formData);
            if (!response.ok) {
                let data;
                try {
                    data = await response.json();
                } catch (_e) {
                    data = {};
                }
                const errorElement = this._element.querySelector('.sign-error-message');
                if (errorElement) {
                    errorElement.textContent = translateError(data.error);
                }
                return;
            }
            Router.getInstance().navigate('/files');
        } catch (_e) {
            this.#inputs[0].showError('Сервер недоступен');
        }
    }

    validateFields() {
        let allValid = true;
        this.#inputs.forEach((input) => {
            if (!input.validate()) {
                allValid = false;
            }
        });
        return allValid;
    }

    get goToRegisterBtn() {
        return this._element.querySelector('#register-from-login-btn');
    }
}
