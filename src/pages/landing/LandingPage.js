import { LandingPageTemplate } from './LandingPage.template.js';
import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';

export class LandingPage {
    #root;
    #header;

    constructor(root) {
        this.#root = root;
    }

    async render() {
        this.#root.innerHTML = '';

        try {
            const response = await HttpClient.getInstance().get('/auth/me');
            if (response.ok) {
                Router.getInstance().navigate('/files');
                return;
            }
        } catch (_e) {
            /* not logged in */
        }

        this.#header = new GreenHeader(this.#root);
        this.#header.render();

        this.#header.registerBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            Router.getInstance().navigate('/sign?mode=register');
        });

        this.#header.loginBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            Router.getInstance().navigate('/sign?mode=login');
        });

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = LandingPageTemplate();
        this.#root.appendChild(tempContainer.firstElementChild);
        this.#attachEvents();
    }

    #attachEvents() {
        const el = this.#root.querySelector('.landing-page');
        if (!el) return;

        el.querySelector('[data-action="create-notebook"]')?.addEventListener('click', () => {
            Router.getInstance().navigate('/sign?mode=login');
        });
    }

    destroy() {
        if (this.#header) this.#header.destroy();
        this.#root.innerHTML = '';
    }
}
