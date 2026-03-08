export const TYPE_INPUT_CONFIG = {
    PASSWORD: {
        type: 'password',
        id: `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        placeholder: 'Пароль',
        required: true,
        pattern: null, // Регулярное выражение для проверки ввода
        error_by_pattern: '',
        minlength: 4,
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
        minlength: 1,
        maxlength: 10
    }
};

export class Input {
    #parent;
    #input;
    #config;
    #state;

    constructor(parent, config) {
        this.#parent = parent;
        this.#config = config;
        this.#state = {
            isValid: true,
            value: ''
        };
    }

    render() {
        const template = Handlebars.templates['Input.hbs'];
        this.#parent.innerHTML = template(this.#config);

        this.#input = this.#parent.querySelector('.input-field');
        this.#attachEvents();
    }

    #attachEvents() {
        this.#input.addEventListener('input', (e) => {
            const rawValue = e.target.value;
            const cleanValue = DOMPurify.sanitize(rawValue);
            if (cleanValue !== rawValue) {
                this.#input.value = cleanValue;
            }
            this.#state.value = cleanValue;
            this.validate();
        });

        this.#input.addEventListener('blur', () => {
            this.validate();
        });
    }

    getValue() {
        return this.#state.value;
    }

    validate() {
        console.log('Validate input');
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
        const wrapper = this.#parent.querySelector('.input-wrapper');
        const errorElement = this.#parent.querySelector('.input-error-message');
        if (!this.#state.isValid) {
            console.log('Not valid');
            wrapper.classList.add('input-wrapper_error');
            if (errorElement) {
                errorElement.textContent = errorMessage;
            } else {
                // Создаём элемент ошибки если его нет
                const newError = document.createElement('span');
                newError.className = 'input-error-message';
                newError.textContent = errorMessage;
                this.#parent.appendChild(newError);
            }
        } else {
            wrapper.classList.remove('input-wrapper_error');
            if (errorElement) {
                errorElement.remove();
            }
        }
    }
}
