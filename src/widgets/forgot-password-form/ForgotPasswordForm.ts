import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { ForgotPasswordTemplate } from './ForgotPasswordForm.template.js';
import { nn } from '../../shared/utils/notNull.js';
import { logError } from '../../shared/utils/logger.js';

/**
 * Форма запроса сброса пароля: одно поле email. После валидации делает
 * POST /auth/forgot-password; при успехе заменяет содержимое на заглушку
 * "Проверьте почту" с инструкцией по дальнейшим действиям.
 */
export class ForgotPasswordForm extends BaseComponent {
    #input: Input | null = null;
    #httpClient: HttpClient;

    /**
     * Создаёт форму, рендерит шаблон и подготавливает поле email.
     * @param parent - родительский элемент
     */
    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#httpClient = HttpClient.getInstance();
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер и создаёт Input-компонент для email.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = ForgotPasswordTemplate({ title: 'Восстановление пароля' });
        this._element = tempContainer.firstElementChild as HTMLElement;
        this.#createInput();
    }

    /**
     * Создаёт Input-компонент для поля email и добавляет его в .form-fields.
     */
    #createInput(): void {
        const fieldsContainer = nn(this._element.querySelector('.form-fields'));
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'form-field';
        fieldContainer.dataset.field = 'email';
        fieldsContainer.appendChild(fieldContainer);
        this.#input = new Input(fieldContainer, TYPE_INPUT_CONFIG.EMAIL);
    }

    /**
     * Маунтит форму и поле email, навешивает submit-обработчик.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        nn(this.#input).mount();
        this.#attachEvents();
    }

    /**
     * Снимает форму с DOM вместе с Input-компонентом.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
        this.#input?.unmount();
    }

    /**
     * Сбрасывает значение поля email.
     */
    public update(): void {
        this.#input?.update();
    }

    /**
     * Навешивает submit-обработчик на кнопку.
     */
    #attachEvents(): void {
        const btn = nn(this._element.querySelector('#forgot-password-btn'));
        this._addListener(btn, 'click', (e: Event) => {
            e.preventDefault();
            void this.#submit();
        });
    }

    /**
     * Валидирует email, отправляет POST /auth/forgot-password. При успехе
     * показывает заглушку "Проверьте почту". При ошибке показывает translateError.
     */
    async #submit(): Promise<void> {
        nn(this._element.querySelector('.sign-error-message')).textContent = '';
        if (!nn(this.#input).validate()) return;

        const email = nn(this.#input).getValue();
        const response = await this.#httpClient.post('/auth/forgot-password', { email });

        let responseData: Record<string, unknown>;
        try {
            responseData = (await response.json()) as Record<string, unknown>;
        } catch (_e) {
            responseData = {};
        }

        if (!response.ok) {
            logError(responseData);
            const errorElement = this._element.querySelector('.sign-error-message');
            if (errorElement) {
                errorElement.textContent = translateError(responseData.error as string);
            }
            return;
        }

        this.#showEmailSent(email);
    }

    /**
     * Заменяет содержимое формы на заглушку "Проверьте почту" с email-адресом
     * и кнопкой возврата к логину.
     * @param email - email на который отправлено письмо со ссылкой
     */
    #showEmailSent(email: string): void {
        this._element.innerHTML = `
            <div class="email-sent">
                <div class="email-sent__icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--teal-green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="M22 4L12 13L2 4"/>
                    </svg>
                </div>
                <h2 class="email-sent__title">Проверьте почту</h2>
                <p class="email-sent__text">
                    На <strong>${email}</strong> отправлено письмо со ссылкой для сброса пароля.
                </p>
                <p class="email-sent__hint">Ссылка действует 1 час. Если письмо не пришло, проверьте папку "Спам"</p>
                <a class="simple-btn email-sent__btn" href="" id="back-to-login-btn">Войти</a>
            </div>`;
    }

    /**
     * Геттер ссылки "Вернуться ко входу" — родительская страница вешает обработчик
     * переключения формы. Активна как до, так и после отправки (внутри email-sent).
     * @returns DOM-элемент ссылки или null если не отрендерено
     */
    public get backToLoginBtn(): HTMLElement | null {
        return this._element.querySelector('#back-to-login-btn');
    }
}
