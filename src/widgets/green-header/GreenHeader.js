export class GreenHeader {
    #parent;
    #config;
    #header;
    #isDropdownOpen = false;
    #listeners = [];

    constructor(parent, config = {}) {
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
    }

    render() {
        const template = Handlebars.templates['GreenHeader'];
        this.#parent.insertAdjacentHTML('afterbegin', template(this.#config));
        this.#header = this.#parent.querySelector('.green-header');
        this.#attachDropdownEvents();
    }

    #attachDropdownEvents() {
        const pill = this.#header.querySelector('.header-user-pill');
        if (!pill) return;

        this.#addListener(pill, 'click', (e) => {
            e.stopPropagation();
            this.#toggleDropdown();
        });

        this.#addListener(document, 'click', () => {
            if (this.#isDropdownOpen) this.#closeDropdown();
        });

        const dropdown = this.#header.querySelector('.header-user-dropdown');
        if (!dropdown) return;

        this.#addListener(dropdown, 'click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('[data-action]');
            if (!item) return;
            const action = item.dataset.action;
            if (action === 'profile' && this.#config.onProfile) {
                this.#config.onProfile();
            } else if (action === 'logout' && this.#config.onLogout) {
                this.#config.onLogout();
            }
            this.#closeDropdown();
        });
    }

    #toggleDropdown() {
        this.#isDropdownOpen ? this.#closeDropdown() : this.#openDropdown();
    }

    #openDropdown() {
        this.#isDropdownOpen = true;
        this.#header
            .querySelector('.header-user-dropdown')
            .classList.add('header-user-dropdown_visible');
    }

    #closeDropdown() {
        this.#isDropdownOpen = false;
        this.#header
            .querySelector('.header-user-dropdown')
            .classList.remove('header-user-dropdown_visible');
    }

    #addListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.#listeners.push({ element, event, handler });
    }

    destroy() {
        this.#listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.#listeners = [];
    }

    get loginBtn() {
        return this.#header.querySelector('[data-action="login"]');
    }

    get registerBtn() {
        return this.#header.querySelector('[data-action="register"]');
    }
}
