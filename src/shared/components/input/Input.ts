import { BaseComponent } from '../base-component/BaseComponent.js';
import { InputTemplate } from './Input.template.js';
import type { InputConfig, InputState } from '../../types.js';
import { nn } from '../../utils/notNull.js';

/**
 * Преднастроенные конфигурации для типовых полей формы (логин/email/пароль).
 * Каждый ключ задаёт type, placeholder, валидационный pattern и сообщение
 * об ошибке — компоненты используют их через spread: `new Input(parent, {...TYPE_INPUT_CONFIG.EMAIL})`.
 */
export const TYPE_INPUT_CONFIG: Record<string, InputConfig> = {
    PASSWORD: {
        type: 'password',
        id: `input-${String(Date.now())}-${Math.random().toString(36).substring(2, 11)}`,
        placeholder: 'Пароль',
        required: true,
        pattern: null,
        error_by_pattern: '',
        minlength: 8,
        maxlength: 50
    },
    REPEAT_PASSWORD: {
        type: 'password',
        id: `input-${String(Date.now())}-${Math.random().toString(36).substring(2, 11)}`,
        placeholder: 'Пароль (повторно)',
        required: true,
        pattern: null,
        error_by_pattern: '',
        minlength: 8,
        maxlength: 50
    },
    EMAIL: {
        type: 'email',
        id: `input-${String(Date.now())}-${Math.random().toString(36).substring(2, 11)}`,
        placeholder: 'Почта',
        required: true,
        pattern: '^\\S+@\\S+\\.\\S+$',
        error_by_pattern: 'Только латиница, доменная зона минимум 2 символа',
        minlength: null,
        maxlength: null
    },
    LOGIN: {
        type: 'text',
        id: `input-${String(Date.now())}-${Math.random().toString(36).substring(2, 11)}`,
        placeholder: 'Логин',
        required: true,
        pattern: '^[a-zA-Z0-9_]{3,20}$',
        error_by_pattern: 'От 3 до 20 символов: только латиница, цифры и _',
        minlength: 3,
        maxlength: 20
    }
};

/**
 * Поле ввода с inline-валидацией и показом ошибок. Поддерживает text/email/password,
 * pattern/required/minlength/maxlength. Для type='password' добавляет кнопку-глаз
 * для показа/скрытия пароля. Состояние (value, isValid) хранится в #state и
 * сбрасывается при clear/unmount.
 */
export class Input extends BaseComponent {
    #input!: HTMLInputElement | null;
    #config: InputConfig;
    #state: InputState;

    /**
     * Создаёт компонент с заданной конфигурацией. Сразу рендерит шаблон в
     * detached-элемент; в DOM попадает только при mount().
     * @param parent - родительский элемент для монтирования
     * @param config - параметры поля (type, placeholder, валидация и т.п.)
     */
    public constructor(parent: HTMLElement, config: InputConfig) {
        super(null, parent);
        this.#config = config;
        this.#state = {
            isValid: true,
            value: ''
        };
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер и сохраняет первый элемент как this._element.
     */
    #render(): void {
        const templateData = {
            ...this.#config,
            isPassword: this.#config.type === 'password'
        };
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = InputTemplate(templateData);
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Вмонтирует поле в DOM, навешивает обработчики ввода/blur и (для пароля)
     * кнопку показа. Идемпотентен — повторный вызов игнорируется.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();

        this.#input = nn(this._element.querySelector('.input-field'));
        this.#attachEvents();

        const toggleBtn = this._element.querySelector('.toggle-password-btn');
        if (toggleBtn) {
            this.#input.classList.add('input-field_has-toggle');
            this._addListener(toggleBtn, 'click', () => {
                const isPassword = nn(this.#input).type === 'password';
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.#input!.type = isPassword ? 'text' : 'password';

                const openIcon = nn(toggleBtn.querySelector('.eye-icon_open'));
                const closedIcon = nn(toggleBtn.querySelector('.eye-icon_closed'));
                openIcon.classList.toggle('eye-icon_hidden');
                closedIcon.classList.toggle('eye-icon_hidden');
            });
        }
    }

    /**
     * Снимает поле с DOM, очищает ссылку на input и сбрасывает состояние.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
        this.#input = null;
        this.#state = {
            isValid: true,
            value: ''
        };
    }

    /**
     * Принудительно сбрасывает значение и состояние ошибки. Вызывается
     * родителями (например формами) при reset или после успешной отправки.
     */
    public update(): void {
        if (!this._isMounted) return;
        this.#state.value = '';
        this.#calmDown();
    }

    /**
     * Навешивает обработчик 'input' для синхронизации #state.value и
     * 'blur' для запуска валидации при потере фокуса.
     */
    #attachEvents(): void {
        this._addListener(this.#input, 'input', (e: unknown) => {
            this.#state.value = (e as InputEvent & { target: HTMLInputElement }).target.value;
            this.#calmDown();
        });
        nn(this.#input).addEventListener('blur', () => {
            this.validate();
        });
    }

    /**
     * Сбрасывает визуальное состояние ошибки (убирает класс и текст сообщения).
     * Вызывается при каждом keystroke чтобы пользователь не видел старую ошибку
     * пока продолжает печатать.
     */
    #calmDown(): void {
        this.#state.isValid = true;
        const errorElement = this._element.querySelector('.input-error-message');
        this._element.classList.remove('input-wrapper_error');
        if (errorElement) {
            errorElement.textContent = ' ';
        }
    }

    /**
     * Валидирует текущее значение по правилам конфига (required/pattern/min/max)
     * и обновляет UI. Вызывается на blur и перед отправкой формы родителем.
     * @returns true если поле валидно
     */
    public validate(): boolean {
        if (this.#input) {
            this.#state.value = this.#input.value;
        }

        let isValid = true;
        let errorMessage = '';

        if (this.#config.required && !this.#state.value) {
            isValid = false;
            errorMessage = 'Это поле обязательно';
        }

        if (isValid && Boolean(this.#config.pattern)) {
            const regex = new RegExp(this.#config.pattern);
            if (!regex.test(this.#state.value)) {
                isValid = false;
                errorMessage = this.#config.error_by_pattern;
            }
        }

        if (
            isValid &&
            Boolean(this.#config.minlength) &&
            this.#state.value.length < this.#config.minlength
        ) {
            isValid = false;
            errorMessage = `Минимум ${String(this.#config.minlength)} символов`;
        }

        if (
            isValid &&
            Boolean(this.#config.maxlength) &&
            this.#state.value.length > this.#config.maxlength
        ) {
            isValid = false;
            errorMessage = `Максимум ${String(this.#config.maxlength)} символов`;
        }

        this.#state.isValid = isValid;
        this.#updateUI(errorMessage);
        return this.#state.isValid;
    }

    /**
     * Обновляет CSS-классы и текст сообщения об ошибке в зависимости от
     * текущего состояния валидности.
     * @param errorMessage - текст ошибки для показа (если поле невалидно)
     */
    #updateUI(errorMessage: string): void {
        const errorElement = this._element.querySelector('.input-error-message');
        if (!this.#state.isValid) {
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
     * Принудительно показывает ошибку с заданным текстом — без локальной валидации.
     * Используется когда ошибка приходит от сервера (например "email уже занят").
     * @param errorMessage - текст серверной ошибки
     */
    public showError(errorMessage: string): void {
        this.#state.isValid = false;
        this.#updateUI(errorMessage);
    }

    /**
     * Возвращает текущее значение поля из внутреннего состояния.
     * @returns строка значения (может быть пустой)
     */
    public getValue(): string {
        return this.#state.value;
    }

    /**
     * Очищает значение в DOM и в состоянии без размонтирования компонента.
     * Используется после успешной отправки формы для подготовки к следующему вводу.
     */
    public clear(): void {
        this.#state = {
            isValid: true,
            value: ''
        };
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.#input!.value = '';
    }
}
