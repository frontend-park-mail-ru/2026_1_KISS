import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { ResetPasswordForm } from '../../widgets/reset-password-form/ResetPasswordForm.js';
import { nn } from '../../shared/utils/notNull.js';
import { Router } from '../../shared/router/Router.js';

/**
 * Страница установки нового пароля (`/reset-password?token=...`). Отображает
 * форму ResetPasswordForm внутри стандартного sign-page макета.
 * Токен из query-строки читается самой формой.
 */
export class ResetPasswordPage {
    #root: HTMLElement;
    #header: GreenHeader | null = null;
    #form: ResetPasswordForm | null = null;

    /**
     * Инициализирует страницу с привязкой к корневому элементу.
     * @param root - корневой DOM-элемент страницы
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
    }

    /**
     * Строит DOM-структуру (шапка + main + container), монтирует форму
     * и навешивает обработчик ссылки "Войти".
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

        this.#form = new ResetPasswordForm(container);
        this.#form.mount();

        this.#attachEvents();
    }

    /**
     * Навешивает обработчик на ссылку "Войти": навигирует на /login.
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
     * Сбрасывает поля формы.
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
