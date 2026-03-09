import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';

const FIELD_NAMES = {
    login: 'login',
    password: 'password'
};

export class Login {
    #parent;
    #formElement;
    #inputs = [];
    constructor(parent) {
        this.#parent = parent;
    }

    render() {
        const template = Handlebars.templates['Login.hbs'];
        const data = {
            title: 'Colab'
        };
        this.#parent.insertAdjacentHTML('beforeend', template(data));

        this.#formElement = this.#parent.querySelector('.login-form');
        this.#createInputs();
        this.#attachEvents();
    }

    #createInputs() {
        let fieldsContainer = this.#formElement.querySelector('.form-fields');
        const fieldsConfig = [
            { name: FIELD_NAMES.login, type: TYPE_INPUT_CONFIG.LOGIN },
            { name: FIELD_NAMES.password, type: TYPE_INPUT_CONFIG.PASSWORD }
        ];

        fieldsConfig.forEach((field) => {
            const fieldContainer = document.createElement('div');
            fieldContainer.className = 'form-field';
            fieldContainer.dataset.field = field.name;
            fieldsContainer.appendChild(fieldContainer);

            const input = new Input(fieldContainer, field.type);
            input.render();

            this.#inputs.push(input);
        });
    }

    #attachEvents() {
        let btn = this.#parent.querySelector('#login-btn');
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.submit();
        });
    }

    submit() {
        if (this.validateFields()) {
            const formData = {
                login: this.#inputs[0].getValue(),
                password: this.#inputs[1].getValue()
            };

            console.log('Форма отправлена:', formData);
            this.#inputs.forEach((input) => {
                input.clear();
            });
            // TODO отправка на сервер
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
        return this.#parent.querySelector('#register-from-login-btn');
    }
}
