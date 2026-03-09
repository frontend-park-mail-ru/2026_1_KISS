import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';

const FIELD_NAMES = {
    login: 'login',
    password: 'password'
};

export class Login extends BaseComponent {
    #inputs = [];
    constructor(parent) {
        super(null, parent);
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
        let fieldsContainer = this._element.querySelector('.form-fields');
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
            this.#inputs.push(input);
        });
    }

    #attachEvents() {
        let btn = this._element.querySelector('#login-btn');
        this._addListener(btn, 'click', (e) => {
            e.preventDefault();
            this.#submit();
        });
    }

    #submit() {
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
        return this._element.querySelector('#register-from-login-btn');
    }
}
