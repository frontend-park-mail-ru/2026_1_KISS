import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { translateError } from '../../shared/utils/serverErrors.js';

const FIELD_NAMES = {
    login: 'login',
    email: 'email',
    password: 'password',
    repeat_password: 'repeat_password'
};

export class Register extends BaseComponent {
    #inputs = [];
    constructor(parent) {
        super(null, parent);
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['Register'];
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

    #attachEvents() {
        const btn = this._element.querySelector('#register-btn');
        this._addListener(btn, 'click', (e) => {
            e.preventDefault();
            this.#submit();
        });
    }

    async #submit() {
        if (!this.validateFields()) return;

        const formData = {
            username: this.#inputs[0].getValue(),
            email: this.#inputs[1].getValue(),
            password: this.#inputs[2].getValue()
        };

        console.log('Форма:', formData);

        const http_client = new HttpClient();
        const response = await http_client.post('/auth/register', formData);
        let responseData;
        try {
            responseData = await response.json();
        } catch (_e) {
            responseData = await response.text();
        }
        console.log('responseData:', responseData);
        if (!response.ok) {
            this.#inputs[2].showError(translateError(responseData.error));
            return;
        }

        const email = this.#inputs[1].getValue();
        const password = this.#inputs[2].getValue();

        const loginResponse = await http_client.post('/auth/login', { email, password });
        if (!loginResponse.ok) {
            let loginData;
            try {
                loginData = await loginResponse.json();
            } catch (_e) {
                loginData = {};
            }
            this.#inputs[1].showError(translateError(loginData.error));
            return;
        }

        Router.getInstance().navigate('/files');
    }

    validateFields() {
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

    get goOutBtn() {
        return this._element.querySelector('#go-out-btn');
    }
}
