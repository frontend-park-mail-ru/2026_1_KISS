import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';

const FIELD_NAMES = {
    login: 'login',
    email: 'email',
    password: 'password',
    repeat_password: 'repeat_password'
};

export class Register {
    #parent;
    #formElement;
    #inputs = [];
    constructor(parent) {
        this.#parent = parent;
    }

    render() {
        const template = Handlebars.templates['Register.hbs'];
        const data = {
            title: 'Colab'
        };
        this.#parent.insertAdjacentHTML('beforeend', template(data));

        this.#formElement = this.#parent.querySelector('.registration-form');
        this.#createInputs();
        this.#attachEvents();
    }

    #createInputs() {
        let fieldsContainer = this.#formElement.querySelector('.form-fields');
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
            input.render();

            this.#inputs.push(input);
        });
    }

    get goOutBtn() {
        return this.#parent.querySelector('#go-out-btn');
    }

    #attachEvents() {
        let btn = this.#parent.querySelector('#register-btn');
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.submit();
        });
    }

    submit() {
        if (this.validateFields()) {
            const formData = {
                login: this.#inputs[0].getValue(),
                email: this.#inputs[1].getValue(),
                password: this.#inputs[2].getValue(),
                repeat_password: this.#inputs[3].getValue()
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

        if (this.#inputs[2].getValue() !== this.#inputs[3].getValue()) {
            allValid = false;
            this.#inputs[3].showError('Пароли не совпадают');
        }
        return allValid;
    }
}
