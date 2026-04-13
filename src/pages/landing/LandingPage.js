import { LandingPageTemplate } from './LandingPage.template.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';

export class LandingPage {
    #root;

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

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = LandingPageTemplate();
        this.#root.appendChild(tempContainer.firstElementChild);
        this.#attachEvents();
    }

    #attachEvents() {
        const el = this.#root.querySelector('.landing-page');
        if (!el) return;

        el.querySelector('[data-action="register"]')?.addEventListener('click', () => {
            Router.getInstance().navigate('/sign?mode=register');
        });

        el.querySelector('[data-action="login"]')?.addEventListener('click', () => {
            Router.getInstance().navigate('/sign?mode=login');
        });

        el.querySelector('[data-action="create-notebook"]')?.addEventListener('click', () => {
            Router.getInstance().navigate('/sign?mode=register');
        });
    }

    destroy() {
        this.#root.innerHTML = '';
    }
}
