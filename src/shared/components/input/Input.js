/**
 * @module shared/components/input/Input
 *
 * Текстовое поле ввода с валидацией, санитизацией через DOMPurify
 * и поддержкой toggle-видимости пароля.
 */

import { BaseComponent } from '../base-component/BaseComponent.js';

/** @typedef {import('../../types.js').InputConfig} InputConfig */
/** @typedef {import('../../types.js').InputState} InputState */

/**
 * Предустановленные конфигурации полей ввода.
 *
 * @type {Object<string, InputConfig>}
 */
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

/**
 * Поле ввода с валидацией (required, pattern, minlength, maxlength),
 * санитизацией DOMPurify и toggle-кнопкой для паролей.
 *
 * @extends BaseComponent
 */
export class Input extends BaseComponent {
    /** @type {HTMLInputElement} */
    #input;

    /** @type {InputConfig} */
    #config;

    /** @type {InputState} */
    #state;

    /**
     * @param {HTMLElement} parent -- контейнер для mount
     * @param {InputConfig} config -- конфигурация поля
     */
    constructor(parent, config) {
        super(null, parent);
        this.#config = config;
        this.#state = {
            isValid: true,
            value: ''
        };
        this.#render();
    }

    /**
     * Компилирует Handlebars-шаблон Input с конфигурацией поля и флагом isPassword для toggle-кнопки.
     *
     * @private
     */
    #render() {
        const template = Handlebars.templates['Input'];
        const templateData = {
            ...this.#config,
            isPassword: this.#config.type === 'password'
        };
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template(templateData);
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();

        this.#input = this._element.querySelector('.input-field');
        this.#attachEvents();

        const toggleBtn = this._element.querySelector('.toggle-password-btn');
        if (toggleBtn) {
            this.#input.classList.add('input-field_has-toggle');
            this._addListener(toggleBtn, 'click', () => {
                const isPassword = this.#input.type === 'password';
                this.#input.type = isPassword ? 'text' : 'password';

                const openIcon = toggleBtn.querySelector('.eye-icon_open');
                const closedIcon = toggleBtn.querySelector('.eye-icon_closed');
                openIcon.classList.toggle('eye-icon_hidden');
                closedIcon.classList.toggle('eye-icon_hidden');
            });
        }
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

    /**
     * Сбрасывает значение и убирает ошибку валидации из UI.
     */
    update() {
        if (!this._isMounted) return;
        this.#state.value = '';
        this.#calmDown();
    }

    /**
     * Подключает обработчик ввода: санитизация через DOMPurify, сброс ошибки при наборе, валидация при blur.
     *
     * @private
     */
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
        this.#input.addEventListener('blur', () => {
            this.validate();
        });
    }

    /**
     * Сбрасывает визуальное состояние ошибки: убирает CSS-класс input-wrapper_error и очищает текст ошибки.
     *
     * @private
     */
    #calmDown() {
        this.#state.isValid = true;
        const errorElement = this._element.querySelector('.input-error-message');
        this._element.classList.remove('input-wrapper_error');
        if (errorElement) {
            errorElement.textContent = ' ';
        }
    }

    /**
     * Последовательно проверяет значение поля: required, pattern, minlength, maxlength.
     * Останавливается на первой ошибке и отображает её в UI.
     *
     * @returns {boolean} true если значение прошло все проверки
     */
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

    /**
     * @private
     * @param {string} errorMessage -- текст ошибки для отображения
     */
    #updateUI(errorMessage) {
        const errorElement = this._element.querySelector('.input-error-message');
        if (!this.#state.isValid) {
            console.log('Not valid: ', errorMessage);
            this._element.classList.add('input-wrapper_error');
            if (errorElement) {
                errorElement.textContent = errorMessage;
            }
        } else {
            this._element.classList.remove('input-wrapper_error');
            if (errorElement) {
                errorElement.textContent = ' ';
            }
        }
    }

    /**
     * Принудительно помечает поле как невалидное и показывает ошибку.
     *
     * @param {string} errorMessage -- текст ошибки
     */
    showError(errorMessage) {
        this.#state.isValid = false;
        this.#updateUI(errorMessage);
    }

    /**
     * @returns {string} текущее значение поля (санитизированное)
     */
    getValue() {
        return this.#state.value;
    }

    /**
     * Очищает значение поля и сбрасывает состояние валидации.
     */
    clear() {
        this.#state = {
            isValid: true,
            value: ''
        };
        this.#input.value = '';
    }
}
