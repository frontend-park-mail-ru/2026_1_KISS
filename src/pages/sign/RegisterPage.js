import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { Register } from '../../widgets/register-form/Register.js';
import { Login } from '../../widgets/login-form/Login.js';
import { Input, TYPE_INPUT_CONFIG } from '../../shared/components/input/Input.js';

const SESSION_ACTIVE_STATE = 'registerPageState';
const LOGIN_STATE = 'login';
const REGISTER_STATE = 'register';

export class RegisterPage {
    #root;
    #header;
    #container;
    #register;
    #login;
    #activeElement;

    constructor(root) {
        this.#root = root;
        this.#header = null;
        this.#register = null;
        this.#activeElement = null;
    }

    render() {
        console.log(Handlebars.templates);
        this.#root.innerHTML = '';

        this.#header = new GreenHeader(this.#root);
        this.#header.render();

        const mainElement = document.createElement('main');
        mainElement.className = 'sign-page__main';
        this.#root.appendChild(mainElement);

        this.#container = document.createElement('div');
        this.#container.className = 'sign-page__container';
        this.#container.id = 'sign-page__container__id';
        mainElement.appendChild(this.#container);

        this.#register = new Register(this.#container);
        this.#login = new Login(this.#container);

        this.#restoreState();
        this.#attachEvents();
    }

    #attachEvents() {
        const moveToRegister = (e) => {
            e.preventDefault();
            this.#activeElement = this.#register;
            this.#saveState();
            this.update();
        };
        const moveToLogin = (e) => {
            e.preventDefault();
            this.#activeElement = this.#login;
            this.#saveState();
            this.update();
        };
        this.#header.loginBtn.addEventListener('click', moveToLogin);

        this.#header.registerBtn.addEventListener('click', moveToRegister);
    }

    update() {
        if (this.#activeElement) {
            this.#container.innerHTML = '';
            this.#activeElement.render();

            if (this.#register) {
                this.#register.goOutBtn.addEventListener('click', moveToLogin);
            }
            if (this.#login) {
                this.#login.goToRegisterBtn.addEventListener('click', moveToRegister);
            }
        }
    }

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

    #restoreState() {
        const savedState = sessionStorage.getItem(SESSION_ACTIVE_STATE);

        if (savedState) {
            try {
                const { activeView } = JSON.parse(savedState);
                this.#activeElement = activeView === LOGIN_STATE ? this.#login : this.#register;
            } catch (e) {
                this.#activeElement = this.#register;
            }
        } else {
            this.#activeElement = this.#register;
        }

        this.update();
    }
}
