import { BaseComponent } from '../base-component/BaseComponent.js';

export const TYPE_INPUT_CONFIG = {
    PASSWORD: {
        type: 'password',
        id: `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        placeholder: 'Пароль',
        required: true,
        pattern: null,
        error_by_pattern: '',
        minlength: 8,
        maxlength: 50
    },
    REPEAT_PASSWORD: {
        type: 'password',
        id: `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        placeholder: 'Пароль (повторно)',
        required: true,
        pattern: null,
        error_by_pattern: '',
        minlength: 8,
        maxlength: 50
    },
    EMAIL: {
        type: 'email',
        id: `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        placeholder: 'Почта',
        required: true,
        pattern: '^\\S+@\\S+\\.\\S+$',
        error_by_pattern: 'Только латиница, доменная зона минимум 2 символа',
        minlength: null,
        maxlength: null
    },
    LOGIN: {
        type: 'text',
        id: `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        placeholder: 'Логин',
        required: true,
        pattern: '^[a-zA-Z0-9_]{3,20}$',
        error_by_pattern: 'От 3 до 20 символов: только латиница, цифры и _',
        minlength: 3,
        maxlength: 20
    }
};

export class Input extends BaseComponent {
    #input;
    #config;
    #state;

    constructor(parent, config) {
        super(null, parent);
        this.#config = config;
        this.#state = {
            isValid: true,
            value: ''
        };
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['Input'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template(this.#config);
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();

        this.#input = this._element.querySelector('.input-field');
        this.#attachEvents();
    }

    unmount() {
        if (!this._isMounted) return;
        super.unmount();
        this.#input = null;
        this.#state = {
            isValid: true,
            value: ''
        };
    }

    update() {
        if (!this._isMounted) return;
        this.#state.value = '';
        this.#calmDown();
    }

    #attachEvents() {
        this._addListener(this.#input, 'input', (e) => {
            const rawValue = e.target.value;
            const cleanValue = DOMPurify.sanitize(rawValue);
            if (cleanValue !== rawValue) {
                this.#input.value = cleanValue;
            }
            this.#state.value = cleanValue;
            this.#calmDown();
        });
    }

    #calmDown() {
        this.#state.isValid = true;
        const errorElement = this._element.querySelector('.input-error-message');
        this._element.classList.remove('input-wrapper_error');
        if (errorElement) {
            errorElement.value = ' ';
        }
    }

    validate() {
        if (this.#input) {
            this.#state.value = DOMPurify.sanitize(this.#input.value);
        }

        let isValid = true;
        let errorMessage = '';

        if (this.#config.required && !this.#state.value) {
            isValid = false;
            errorMessage = 'Это поле обязательно';
        }

        if (isValid && this.#config.pattern) {
            const regex = new RegExp(this.#config.pattern);
            if (!regex.test(this.#state.value)) {
                isValid = false;
                errorMessage = this.#config.error_by_pattern;
            }
        }

        if (
            isValid &&
            this.#config.minlength &&
            this.#state.value.length < this.#config.minlength
        ) {
            isValid = false;
            errorMessage = `Минимум ${this.#config.minlength} символов`;
        }

        if (
            isValid &&
            this.#config.maxlength &&
            this.#state.value.length > this.#config.maxlength
        ) {
            isValid = false;
            errorMessage = `Максимум ${this.#config.maxlength} символов`;
        }

        this.#state.isValid = isValid;
        this.#updateUI(errorMessage);
        return this.#state.isValid;
    }

    #updateUI(errorMessage) {
        const errorElement = this._element.querySelector('.input-error-message');
        if (!this.#state.isValid) {
            console.log('Not valid: ', errorMessage);
            this._element.classList.add('input-wrapper_error');
            if (errorElement) {
                errorElement.textContent = errorMessage;
            } else {
                const newError = document.createElement('span');
                newError.className = 'input-error-message';
                newError.textContent = errorMessage;
                this._element.appendChild(newError);
            }
        } else {
            this._element.classList.remove('input-wrapper_error');
            if (errorElement) {
                errorElement.value = ' ';
            }
        }
    }

    showError(errorMessage) {
        this.#state.isValid = false;
        this.#updateUI(errorMessage);
    }

    getValue() {
        return this.#state.value;
    }

    clear() {
        this.#state = {
            isValid: true,
            value: ''
        };
        this.#input.value = '';
    }
}
