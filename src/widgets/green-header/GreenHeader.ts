import { GreenHeaderTemplate } from './GreenHeader.template.js';
import type { EventListenerRecord } from '../../shared/types.js';

interface HeaderUser {
    avatarUrl?: string;
    initials: string;
    username: string;
}

interface GreenHeaderConfig {
    logo?: string;
    user?: HeaderUser;
    buttons?: { text: string; class: string; action: string }[];
    onProfile?: (() => void) | null;
    onLogout?: (() => void) | null;
    onAdmin?: (() => void) | null;
    onFeedback?: (() => void) | null;
}

export class GreenHeader {
    #parent: HTMLElement;
    #config: GreenHeaderConfig;
    #header!: HTMLElement;
    #isDropdownOpen = false;
    #listeners: EventListenerRecord[] = [];

    constructor(parent: HTMLElement, config: GreenHeaderConfig = {}) {
        this.#parent = parent;
        this.#config = {
            logo: '/images/NewLogoTransparentWhite.svg'
        };

        if (config.user) {
            this.#config.user = config.user;
        } else {
            this.#config.buttons = [
                { text: 'Войти', class: 'just-text', action: 'login' },
                { text: 'Регистрация', class: 'just-text', action: 'register' }
            ];
        }

        this.#config.onProfile = config.onProfile || null;
        this.#config.onLogout = config.onLogout || null;
        this.#config.onAdmin = config.onAdmin || null;
        this.#config.onFeedback = config.onFeedback || null;
    }

    render(): void {
        this.#parent.insertAdjacentHTML('afterbegin', GreenHeaderTemplate(this.#config as Parameters<typeof GreenHeaderTemplate>[0]));
        this.#header = this.#parent.querySelector('.green-header') as HTMLElement;
        this.#attachDropdownEvents();
    }

    #attachDropdownEvents(): void {
        const pill = this.#header.querySelector('.header-user-pill');
        if (!pill) return;

        this.#addListener(pill, 'click', (e: Event) => {
            e.stopPropagation();
            this.#toggleDropdown();
        });

        this.#addListener(document, 'click', () => {
            if (this.#isDropdownOpen) this.#closeDropdown();
        });

        const dropdown = this.#header.querySelector('.header-user-dropdown');
        if (!dropdown) return;

        this.#addListener(dropdown, 'click', (e: Event) => {
            e.stopPropagation();
            const item = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
            if (!item) return;
            const action = item.dataset.action;
            if (action === 'profile' && this.#config.onProfile) {
                this.#config.onProfile();
            } else if (action === 'admin' && this.#config.onAdmin) {
                this.#config.onAdmin();
            } else if (action === 'feedback' && this.#config.onFeedback) {
                this.#config.onFeedback();
            } else if (action === 'logout' && this.#config.onLogout) {
                this.#config.onLogout();
            }
            this.#closeDropdown();
        });
    }

    #toggleDropdown(): void {
        if (this.#isDropdownOpen) {
            this.#closeDropdown();
        } else {
            this.#openDropdown();
        }
    }

    #openDropdown(): void {
        this.#isDropdownOpen = true;
        this.#header
            .querySelector('.header-user-dropdown')!
            .classList.add('header-user-dropdown_visible');
    }

    #closeDropdown(): void {
        this.#isDropdownOpen = false;
        this.#header
            .querySelector('.header-user-dropdown')!
            .classList.remove('header-user-dropdown_visible');
    }

    #addListener(element: EventTarget, event: string, handler: EventListener): void {
        element.addEventListener(event, handler);
        this.#listeners.push({ element, event, handler });
    }

    destroy(): void {
        this.#listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.#listeners = [];
    }

    get loginBtn(): HTMLElement | null {
        return this.#header.querySelector('[data-action="login"]');
    }

    get registerBtn(): HTMLElement | null {
        return this.#header.querySelector('[data-action="register"]');
    }
}
