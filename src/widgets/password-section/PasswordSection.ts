import { PasswordSectionTemplate } from './PasswordSection.template.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Секция смены пароля в профиле: три поля Input (текущий/новый/повтор),
 * валидация совпадения паролей на клиенте, отправка PUT /users/me/password.
 * При успехе — очистка полей + сообщение об успехе; при ошибке — translateError.
 */
export class PasswordSection extends BaseComponent {
    #httpClient: HttpClient;
    #currentInput!: Input;
    #newInput!: Input;
    #confirmInput!: Input;

    /**
     * Создаёт секцию и рендерит шаблон. Input'ы создаются в mount() (требуют
     * существующих DOM-элементов wrap'ов).
     * @param parent - родительский элемент
     */
    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = PasswordSectionTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит секцию, создаёт три Input-компонента (PASSWORD/PASSWORD/REPEAT_PASSWORD)
     * с уникальными id, монтирует их и навешивает submit-обработчик.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();

        this.#currentInput = new Input(
            nn(this._element.querySelector('.password-section__current-wrap')),
            {
                ...TYPE_INPUT_CONFIG.PASSWORD,
                id: `pwd-current-${String(Date.now())}`,
                placeholder: 'Текущий пароль'
            }
        );
        this.#newInput = new Input(nn(this._element.querySelector('.password-section__new-wrap')), {
            ...TYPE_INPUT_CONFIG.PASSWORD,
            id: `pwd-new-${String(Date.now())}`,
            placeholder: 'Новый пароль'
        });
        this.#confirmInput = new Input(
            nn(this._element.querySelector('.password-section__confirm-wrap')),
            {
                ...TYPE_INPUT_CONFIG.REPEAT_PASSWORD,
                id: `pwd-confirm-${String(Date.now())}`,
                placeholder: 'Повторите новый пароль'
            }
        );

        this.#currentInput.mount();
        this.#newInput.mount();
        this.#confirmInput.mount();

        this.#attachSubmit();
    }

    /**
     * Снимает с DOM включая все три Input'а.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        this.#currentInput.unmount();
        this.#newInput.unmount();
        this.#confirmInput.unmount();
        super.unmount();
    }

    /**
     * Навешивает submit-обработчик: валидирует поля + проверяет совпадение
     * нового и повтора, отправляет PUT /users/me/password. При успехе очищает
     * все поля и показывает сообщение; при ошибке — translateError.
     */
    #attachSubmit(): void {
        const btn = nn(this._element.querySelector('.password-section__submit-btn'));
        const msgEl = nn(this._element.querySelector('.password-section__msg'));

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
                    const result = (await response.json()) as { error?: string };
                    msgEl.textContent = translateError(result.error ?? '');
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
