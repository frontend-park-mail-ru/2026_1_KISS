/**
 * @module widgets/green-header/GreenHeader
 */

/** @typedef {import('../../shared/types.js').GreenHeaderConfig} GreenHeaderConfig */
/** @typedef {import('../../shared/types.js').EventListenerRecord} EventListenerRecord */

/**
 * Зелёный header приложения с логотипом и кнопками auth/user-pill.
 * Не наследует BaseComponent -- собственная система управления listeners.
 */
export class GreenHeader {
    /** @type {HTMLElement} */
    #parent;

    /** @type {Object} */
    #config;

    /** @type {HTMLElement} */
    #header;

    /** @type {boolean} */
    #isDropdownOpen = false;

    /** @type {EventListenerRecord[]} */
    #listeners = [];

    /**
     * @param {HTMLElement} parent -- корневой элемент для вставки header
     * @param {GreenHeaderConfig} [config={}]
     */
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

    /**
     * Рендерит header в начало parent и подключает события dropdown.
     */
    render() {
        const template = Handlebars.templates['GreenHeader'];
        this.#parent.insertAdjacentHTML('afterbegin', template(this.#config));
        this.#header = this.#parent.querySelector('.green-header');
        this.#attachDropdownEvents();
    }

    /**
     * Подключает обработчики user-pill dropdown: toggle по клику на pill, закрытие по клику вне, действия профиль/выход.
     *
     * @private
     */
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

    /**
     * Переключает видимость user dropdown.
     *
     * @private
     */
    #toggleDropdown() {
        this.#isDropdownOpen ? this.#closeDropdown() : this.#openDropdown();
    }

    /**
     * Показывает user dropdown, добавляя CSS-модификатор видимости.
     *
     * @private
     */
    #openDropdown() {
        this.#isDropdownOpen = true;
        this.#header
            .querySelector('.header-user-dropdown')
            .classList.add('header-user-dropdown_visible');
    }

    /**
     * Скрывает user dropdown, убирая CSS-модификатор видимости.
     *
     * @private
     */
    #closeDropdown() {
        this.#isDropdownOpen = false;
        this.#header
            .querySelector('.header-user-dropdown')
            .classList.remove('header-user-dropdown_visible');
    }

    /**
     * @private
     * @param {EventTarget} element
     * @param {string} event
     * @param {Function} handler
     */
    #addListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.#listeners.push({ element, event, handler });
    }

    /**
     * Снимает все подписки на события.
     */
    destroy() {
        this.#listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.#listeners = [];
    }

    /** @type {?HTMLElement} @readonly */
    get loginBtn() {
        return this.#header.querySelector('[data-action="login"]');
    }

    /** @type {?HTMLElement} @readonly */
    get registerBtn() {
        return this.#header.querySelector('[data-action="register"]');
    }
}
