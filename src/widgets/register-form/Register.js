/**
 * @module widgets/register-form/Register
 */

import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { translateError } from '../../shared/utils/serverErrors.js';

/** @type {Object<string, string>} */
const FIELD_NAMES = {
    login: 'login',
    email: 'email',
    password: 'password',
    repeat_password: 'repeat_password'
};

/**
 * Форма регистрации (логин, email, пароль, повтор пароля).
 * После успешной регистрации автоматически логинит и навигирует на /files.
 *
 * @extends BaseComponent
 */
export class Register extends BaseComponent {
    /** @type {Input[]} */
    #inputs = [];

    /** @type {HttpClient} */
    #httpClient;

    /**
     * @param {HTMLElement} parent
     */
    constructor(parent) {
        super(null, parent);
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    /** @private */
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

    /**
     * Сбрасывает состояние всех полей ввода.
     */
    update() {
        this.#inputs.forEach((input) => {
            input.update();
        });
    }

    /** @private */
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

    /** @private */
    #attachEvents() {
        const btn = this._element.querySelector('#register-btn');
        this._addListener(btn, 'click', (e) => {
            e.preventDefault();
            this.#submit();
        });
    }

    /**
     * Валидирует поля, отправляет POST /auth/register, затем авто-логин.
     * При ошибке -- показывает переведённое сообщение.
     *
     * @private
     * @async
     */
    async #submit() {
        this._element.querySelector('.sign-error-message').textContent = '';
        if (!this.validateFields()) return;

        const formData = {
            username: this.#inputs[0].getValue(),
            email: this.#inputs[1].getValue(),
            password: this.#inputs[2].getValue()
        };

        const response = await this.#httpClient.post('/auth/register', formData);
        let responseData;
        try {
            responseData = await response.json();
        } catch (_e) {
            responseData = await response.text();
        }

        if (!response.ok) {
            console.log(responseData);
            const errorElement = this._element.querySelector('.sign-error-message');
            if (errorElement) {
                errorElement.textContent = translateError(responseData.error);
            }
            return;
        }

        const email = this.#inputs[1].getValue();
        const password = this.#inputs[2].getValue();

        const loginResponse = await this.#httpClient.post('/auth/login', {
            email,
            password
        });
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

    /**
     * Валидирует все поля и дополнительно проверяет совпадение паролей.
     *
     * @returns {boolean} true если все поля валидны и пароли совпадают
     */
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

    /** @type {?HTMLElement} @readonly */
    get goOutBtn() {
        return this._element.querySelector('#go-out-btn');
    }
}
