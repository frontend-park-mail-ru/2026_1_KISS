import { LandingPageTemplate } from './LandingPage.template.js';
import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Главная (landing) страница для гостей. Сначала проверяет авторизацию через
 * /auth/me — если пользователь уже залогинен, сразу редиректит на /files
 * (чтобы не показывать landing залогиненным). Иначе рендерит шапку с
 * Войти/Регистрация и hero-секцию с CTA.
 */
export class LandingPage {
    #root: HTMLElement;
    #header: GreenHeader | null = null;

    /**
     * Сохраняет ссылку на корневой элемент. Реальный рендер откладывается до render().
     * @param root - корневой элемент SPA
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
    }

    /**
     * Рендерит landing-страницу. Перед рендером проверяет /auth/me — если 200,
     * редиректит на /files без рендера. Иначе создаёт шапку с гостевыми кнопками
     * (login/register с навигацией на /sign?mode=...) и тело страницы.
     */
    public async render(): Promise<void> {
        this.#root.innerHTML = '';

        try {
            const response = await HttpClient.getInstance().get('/auth/me');
            if (response.ok) {
                nn(Router.getInstance()).navigate('/files');
                return;
            }
        } catch (_e) {
            /* not logged in */
        }

        this.#header = new GreenHeader(this.#root);
        this.#header.render();

        this.#header.registerBtn?.addEventListener('click', (e: Event) => {
            e.preventDefault();
            nn(Router.getInstance()).navigate('/sign?mode=register');
        });

        this.#header.loginBtn?.addEventListener('click', (e: Event) => {
            e.preventDefault();
            nn(Router.getInstance()).navigate('/sign?mode=login');
        });

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = LandingPageTemplate();
        this.#root.appendChild(nn(tempContainer.firstElementChild));
        this.#attachEvents();
    }

    /**
     * Навешивает обработчик единственной CTA-кнопки "Создать блокнот" — ведёт
     * на /sign?mode=login (требуется авторизация для создания).
     */
    #attachEvents(): void {
        const el = this.#root.querySelector('.landing-page');
        if (!el) return;

        el.querySelector('[data-action="create-notebook"]')?.addEventListener('click', () => {
            nn(Router.getInstance()).navigate('/sign?mode=login');
        });
    }

    /**
     * Уничтожает шапку (снимает обработчики) и очищает root. Вызывается роутером
     * при навигации на следующую страницу.
     */
    public destroy(): void {
        if (this.#header) this.#header.destroy();
        this.#root.innerHTML = '';
    }
}
