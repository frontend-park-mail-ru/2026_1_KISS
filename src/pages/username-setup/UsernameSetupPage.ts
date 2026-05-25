import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { translateError } from '../../shared/utils/serverErrors.js';
import { UsernameSetupPageTemplate } from './UsernameSetupPage.template.js';
import { nn } from '../../shared/utils/notNull.js';
import type { EventListenerRecord } from '../../shared/types.js';
import type { ApiEnvelope, UserDTO } from '../../shared/api/types.js';

/**
 * Страница обязательного выбора имени пользователя (`/username-setup`).
 * Показывается после OAuth-входа, когда провайдер прислал недопустимое имя
 * (например кириллицей) и на бэкенде выставлен флаг username_pending. Содержит
 * одно поле (Input по LOGIN-конфигу) с динамической валидацией и кнопку
 * сохранения: на submit делает PUT /users/me и при успехе редиректит на /files,
 * где шапка перечитывает /auth/me (GET-кэш уже сброшен mutation-запросом).
 */
export class UsernameSetupPage {
    #root: HTMLElement;
    #httpClient: HttpClient;
    #input: Input | null = null;
    #errorEl: HTMLElement | null = null;
    #listeners: EventListenerRecord[] = [];

    /**
     * Инициализирует страницу с привязкой к корневому элементу.
     * @param root - корневой DOM-элемент страницы
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
    }

    /**
     * Рендерит карточку, монтирует поле ввода и навешивает обработчики
     * динамической валидации и отправки.
     */
    public render(): void {
        this.#root.innerHTML = UsernameSetupPageTemplate();

        this.#errorEl = nn(this.#root.querySelector<HTMLElement>('.username-setup-page__error'));

        const fieldWrap = nn(this.#root.querySelector<HTMLElement>('.username-setup-page__field'));
        this.#input = new Input(fieldWrap, {
            ...TYPE_INPUT_CONFIG.LOGIN,
            id: `username-setup-${String(Date.now())}`,
            placeholder: 'Имя пользователя'
        });
        this.#input.mount();

        this.#attachEvents(fieldWrap);
    }

    /**
     * Навешивает динамическую валидацию (на каждый ввод) для переключения
     * доступности кнопки и обработчики submit (клик по кнопке и Enter в поле).
     * @param fieldWrap - контейнер поля ввода
     */
    #attachEvents(fieldWrap: HTMLElement): void {
        const submitBtn = nn(this.#root.querySelector<HTMLButtonElement>('#username-setup-submit'));
        const inputEl = nn(fieldWrap.querySelector<HTMLInputElement>('.input-field'));

        this.#addListener(inputEl, 'input', () => {
            submitBtn.disabled = !nn(this.#input).validate();
        });

        this.#addListener(inputEl, 'keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Enter') void this.#submit();
        });

        this.#addListener(submitBtn, 'click', () => {
            void this.#submit();
        });
    }

    /**
     * Валидирует имя и отправляет PUT /users/me. При успехе редиректит на /files;
     * при ошибке показывает translateError.
     */
    async #submit(): Promise<void> {
        const errorEl = nn(this.#errorEl);
        errorEl.textContent = '';

        if (!nn(this.#input).validate()) return;

        const username = nn(this.#input).getValue();

        try {
            const response = await this.#httpClient.put('/users/me', {
                username,
                status: '',
                description: ''
            });
            const result = (await response.json()) as Partial<ApiEnvelope<UserDTO>>;

            if (!response.ok) {
                errorEl.textContent = translateError(result.error ?? '');
                return;
            }

            this.#httpClient.setUsernamePending(false);
            nn(Router.getInstance()).navigate('/files');
        } catch (_e) {
            errorEl.textContent = 'Ошибка сохранения, попробуйте позже';
        }
    }

    /**
     * Регистрирует обработчик и сохраняет запись для последующего снятия в destroy.
     * @param element - целевой EventTarget
     * @param event - имя события
     * @param handler - функция-обработчик
     */
    #addListener(element: EventTarget, event: string, handler: EventListener): void {
        element.addEventListener(event, handler);
        this.#listeners.push({ element, event, handler });
    }

    /**
     * Снимает обработчики, размонтирует поле и очищает root. Вызывается роутером
     * при навигации на другую страницу.
     */
    public destroy(): void {
        this.#listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.#listeners = [];
        this.#input?.unmount();
        this.#errorEl = null;
        this.#root.innerHTML = '';
    }
}
