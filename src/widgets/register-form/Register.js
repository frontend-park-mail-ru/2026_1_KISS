import { Input, TYPE_INPUT_CONFIG } from '../../shared/input/Input.js';

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
        this.#parent.innerHTML = template(data);

        this.#formElement = this.#parent.querySelector('.registration-form');
        this.#createInputs();
        this.#attachEvents();
    }

    #createInputs() {
        let fieldsContainer = this.#formElement.querySelector('.form-fields');
        const fieldsConfig = [
            { name: 'login', type: TYPE_INPUT_CONFIG.LOGIN },
            { name: 'email', type: TYPE_INPUT_CONFIG.EMAIL },
            { name: 'password', type: TYPE_INPUT_CONFIG.PASSWORD }
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
        let btn = this.#parent.querySelector('#register-btn');
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.submit();
        });
    }

    submit() {
        const allValid = this.#inputs.every((input) => input.validate());

        if (allValid) {
            const formData = {};
            this.#inputs.forEach((input, index) => {
                const fieldName = ['login', 'email', 'password'][index];
                formData[fieldName] = input.getValue();
            });

            console.log('Форма отправлена:', formData);
            // TODO отправка на сервер
        }
    }
}
