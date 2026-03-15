/**
 * @module widgets/login-form/Login
 */

import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { translateError } from '../../shared/utils/serverErrors.js';

/** @type {Object<string, string>} */
const FIELD_NAMES = {
    email: 'email',
    password: 'password'
};

/**
 * Форма авторизации (email + пароль).
 * При успешном логине навигирует на /files.
 *
 * @extends BaseComponent
 */
export class Login extends BaseComponent {
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

    /**
     * Компилирует Handlebars-шаблон Login и создаёт DOM-элемент формы, затем инициализирует поля ввода.
     *
     * @private
     */
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

    /**
     * Сбрасывает состояние всех полей ввода.
     */
    update() {
        this.#inputs.forEach((input) => {
            input.update();
        });
    }

    /**
     * Создаёт компоненты Input (email, password) и добавляет их контейнеры в form-fields.
     *
     * @private
     */
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

    /**
     * Подключает обработчик submit-кнопки, запускающий отправку формы.
     *
     * @private
     */
    #attachEvents() {
        const btn = this._element.querySelector('#login-btn');
        this._addListener(btn, 'click', (e) => {
            e.preventDefault();
            this.#submit();
        });
    }

    /**
     * Валидирует поля, отправляет POST /auth/login.
     * При ошибке -- показывает переведённое сообщение.
     *
     * @private
     * @async
     */
    async #submit() {
        this._element.querySelector('.sign-error-message').textContent = '';
        if (!this.validateFields()) return;

        const formData = {
            email: this.#inputs[0].getValue(),
            password: this.#inputs[1].getValue()
        };

        try {
            const response = await this.#httpClient.post('/auth/login', formData);
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

    /**
     * Запускает валидацию всех полей формы.
     *
     * @returns {boolean} true если все поля валидны
     */
    validateFields() {
        let allValid = true;
        this.#inputs.forEach((input) => {
            if (!input.validate()) {
                allValid = false;
            }
        });
        return allValid;
    }

    /** @type {?HTMLElement} @readonly */
    get goToRegisterBtn() {
        return this._element.querySelector('#register-from-login-btn');
    }
}
