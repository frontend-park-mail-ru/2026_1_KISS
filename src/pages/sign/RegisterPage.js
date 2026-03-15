/**
 * @module pages/sign/RegisterPage
 *
 * Страница авторизации: переключение между формами Login и Register.
 * Состояние (какая форма активна) сохраняется в sessionStorage.
 */

import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { Register } from '../../widgets/register-form/Register.js';
import { Login } from '../../widgets/login-form/Login.js';

/** @type {string} */
const SESSION_ACTIVE_STATE = 'registerPageState';

/** @type {string} */
const LOGIN_STATE = 'login';

/** @type {string} */
const REGISTER_STATE = 'register';

/**
 * Страница /sign -- авторизация и регистрация.
 * Хранит две формы (Login, Register) и переключается между ними
 * по кнопкам в header и внутри форм.
 */
export class RegisterPage {
    /** @type {HTMLElement} */
    #root;

    /** @type {{header: ?GreenHeader, main: ?HTMLElement}} */
    #elements;

    /** @type {Login|Register} */
    #activeElement;

    /** @type {?Register} */
    #register;

    /** @type {?Login} */
    #login;

    /**
     * @param {HTMLElement} root -- корневой элемент для рендера
     */
    constructor(root) {
        this.#root = root;
        this.#elements = {
            header: null,
            main: null
        };
        this.#activeElement = null;
        this.#register = null;
        this.#login = null;
    }

    /**
     * Рендерит header, создаёт формы и восстанавливает последнее активное состояние.
     */
    render() {
        this.#root.innerHTML = '';

        this.#elements.header = new GreenHeader(this.#root);
        this.#elements.header.render();

        this.#elements.main = document.createElement('main');
        this.#elements.main.className = 'sign-page__main';
        this.#root.appendChild(this.#elements.main);

        const containerMain = document.createElement('div');
        containerMain.className = 'sign-page__container';
        containerMain.id = 'sign-page__container__id';
        this.#elements.main.appendChild(containerMain);

        this.#register = new Register(containerMain);
        this.#login = new Login(containerMain);
        this.#activeElement = this.#restoreState();
        this.#activeElement.mount();
        this.#attachEvents();
    }

    /** @private */
    #attachEvents() {
        const moveToRegister = (e) => {
            e.preventDefault();
            this.#register.mount();
            this.#login.unmount();
            this.#activeElement = this.#register;
            this.#saveState();
            this.update();
        };
        const moveToLogin = (e) => {
            e.preventDefault();
            this.#register.unmount();
            this.#login.mount();
            this.#activeElement = this.#login;
            this.#saveState();
            this.update();
        };
        this.#elements.header.loginBtn.addEventListener('click', moveToLogin);
        this.#elements.header.registerBtn.addEventListener('click', moveToRegister);
        if (this.#register) {
            this.#register.goOutBtn.addEventListener('click', moveToLogin);
        }
        if (this.#login) {
            this.#login.goToRegisterBtn.addEventListener('click', moveToRegister);
        }
    }

    /**
     * Сбрасывает состояние полей активной формы.
     */
    update() {
        this.#activeElement.update();
    }

    /** @private */
    #saveState() {
        let activeView = REGISTER_STATE;
        if (this.#activeElement === this.#login) {
            activeView = LOGIN_STATE;
        }
        sessionStorage.setItem(
            SESSION_ACTIVE_STATE,
            JSON.stringify({
                activeView: activeView
            })
        );
    }

    /**
     * Восстанавливает активную форму из sessionStorage.
     *
     * @private
     * @returns {Login|Register} форма для отображения
     */
    #restoreState() {
        const savedState = sessionStorage.getItem(SESSION_ACTIVE_STATE);
        if (savedState) {
            try {
                const { activeView } = JSON.parse(savedState);
                return activeView === LOGIN_STATE ? this.#login : this.#register;
            } catch (_e) {
                return this.#register;
            }
        } else {
            return this.#register;
        }
    }

    /**
     * Размонтирует обе формы и очищает DOM.
     */
    destroy() {
        if (this.#login) this.#login.unmount();
        if (this.#register) this.#register.unmount();
        this.#root.innerHTML = '';
    }
}
