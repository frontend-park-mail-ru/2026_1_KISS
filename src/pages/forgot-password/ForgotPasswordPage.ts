import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { ForgotPasswordForm } from '../../widgets/forgot-password-form/ForgotPasswordForm.js';
import { nn } from '../../shared/utils/notNull.js';
import { Router } from '../../shared/router/Router.js';

/**
 * Страница запроса сброса пароля (`/forgot-password`). Отображает форму
 * ForgotPasswordForm внутри стандартного sign-page макета с шапкой.
 * После успеха форма сама показывает заглушку "Проверьте почту".
 */
export class ForgotPasswordPage {
    #root: HTMLElement;
    #header: GreenHeader | null = null;
    #form: ForgotPasswordForm | null = null;

    /**
     * Инициализирует страницу с привязкой к корневому элементу.
     * @param root - корневой DOM-элемент страницы
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
    }

    /**
     * Строит DOM-структуру (шапка + main + container), монтирует форму
     * и навешивает обработчик кнопки "Вернуться ко входу".
     */
    public render(): void {
        this.#root.innerHTML = '';

        this.#header = new GreenHeader(this.#root);
        this.#header.render();

        const main = document.createElement('main');
        main.className = 'sign-page__main';
        this.#root.appendChild(main);

        const container = document.createElement('div');
        container.className = 'sign-page__container';
        main.appendChild(container);

        this.#form = new ForgotPasswordForm(container);
        this.#form.mount();

        this.#attachEvents();
    }

    /**
     * Навешивает обработчик на ссылку "Вернуться ко входу": навигирует на /login.
     */
    #attachEvents(): void {
        const router = nn(Router.getInstance());
        const backBtn = nn(this.#form).backToLoginBtn;
        if (backBtn !== null) {
            backBtn.addEventListener('click', (e: Event) => {
                e.preventDefault();
                router.navigate('/login');
            });
        }
    }

    /**
     * Сбрасывает поля формы. Вызывается роутером при повторном входе на страницу.
     */
    public update(): void {
        this.#form?.update();
    }

    /**
     * Размонтирует форму и очищает root. Вызывается роутером при навигации.
     */
    public destroy(): void {
        this.#form?.unmount();
        this.#root.innerHTML = '';
    }
}
