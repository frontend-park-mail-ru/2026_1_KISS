import { LandingPageTemplate } from './LandingPage.template.js';
import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { nn } from '../../shared/utils/notNull.js';

export class LandingPage {
    #root: HTMLElement;
    #header: GreenHeader | null = null;

    public constructor(root: HTMLElement) {
        this.#root = root;
    }

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

    #attachEvents(): void {
        const el = this.#root.querySelector('.landing-page');
        if (!el) return;

        el.querySelector('[data-action="create-notebook"]')?.addEventListener('click', () => {
            nn(Router.getInstance()).navigate('/sign?mode=login');
        });
    }

    public destroy(): void {
        if (this.#header) this.#header.destroy();
        this.#root.innerHTML = '';
    }
}
