import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { translateError } from '../../shared/utils/serverErrors.js';

/**
 * PasswordSection provides a form to change the user's password.
 * @extends BaseComponent
 */
export class PasswordSection extends BaseComponent {
    #httpClient;
    #currentInput;
    #newInput;
    #confirmInput;

    /**
     * @param {HTMLElement} parent - container element
     */
    constructor(parent) {
        super(null, parent);
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    /**
     * Renders the section from the Handlebars template.
     */
    #render() {
        const template = Handlebars.templates['PasswordSection'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template();
        this._element = tempContainer.firstElementChild;
    }

    /**
     * Mounts the component, creates Input widgets, and attaches events.
     */
    mount() {
        if (this._isMounted) return;
        super.mount();

        this.#currentInput = new Input(
            this._element.querySelector('.password-section__current-wrap'),
            {
                ...TYPE_INPUT_CONFIG.PASSWORD,
                id: `pwd-current-${Date.now()}`,
                placeholder: 'Текущий пароль'
            }
        );
        this.#newInput = new Input(this._element.querySelector('.password-section__new-wrap'), {
            ...TYPE_INPUT_CONFIG.PASSWORD,
            id: `pwd-new-${Date.now()}`,
            placeholder: 'Новый пароль'
        });
        this.#confirmInput = new Input(
            this._element.querySelector('.password-section__confirm-wrap'),
            {
                ...TYPE_INPUT_CONFIG.REPEAT_PASSWORD,
                id: `pwd-confirm-${Date.now()}`,
                placeholder: 'Повторите новый пароль'
            }
        );

        this.#currentInput.mount();
        this.#newInput.mount();
        this.#confirmInput.mount();

        this.#attachSubmit();
    }

    /**
     * Unmounts the component and child Input widgets.
     */
    unmount() {
        if (!this._isMounted) return;
        if (this.#currentInput) this.#currentInput.unmount();
        if (this.#newInput) this.#newInput.unmount();
        if (this.#confirmInput) this.#confirmInput.unmount();
        super.unmount();
    }

    /**
     * Attaches submit button event handler.
     */
    #attachSubmit() {
        const btn = this._element.querySelector('.password-section__submit-btn');
        const msgEl = this._element.querySelector('.password-section__msg');

        this._addListener(btn, 'click', async () => {
            const currentValid = this.#currentInput.validate();
            const newValid = this.#newInput.validate();
            const confirmValid = this.#confirmInput.validate();

            if (!currentValid || !newValid || !confirmValid) return;

            const newPass = this.#newInput.getValue();
            const confirmPass = this.#confirmInput.getValue();

            if (newPass !== confirmPass) {
                this.#confirmInput.showError('Пароли не совпадают');
                return;
            }

            msgEl.textContent = '';
            msgEl.className = 'password-section__msg';

            try {
                const response = await this.#httpClient.put('/users/me/password', {
                    current_password: this.#currentInput.getValue(),
                    new_password: newPass
                });

                if (!response.ok) {
                    const result = await response.json();
                    msgEl.textContent = translateError(result.error);
                    msgEl.classList.add('password-section__msg--error');
                    return;
                }

                msgEl.textContent = 'Пароль успешно изменен';
                msgEl.classList.add('password-section__msg--success');
                this.#currentInput.clear();
                this.#newInput.clear();
                this.#confirmInput.clear();
            } catch (_e) {
                msgEl.textContent = 'Ошибка смены пароля';
                msgEl.classList.add('password-section__msg--error');
            }
        });
    }
}
