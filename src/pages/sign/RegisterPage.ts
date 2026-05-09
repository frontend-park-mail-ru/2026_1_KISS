import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { Register } from '../../widgets/register-form/Register.js';
import { Login } from '../../widgets/login-form/Login.js';

const SESSION_ACTIVE_STATE = 'registerPageState';
const LOGIN_STATE = 'login';
const REGISTER_STATE = 'register';

export class RegisterPage {
    #root: HTMLElement;
    #elements: { header: GreenHeader | null; main: HTMLElement | null };
    #activeElement: Login | Register | null;
    #register: Register | null;
    #login: Login | null;

    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#elements = {
            header: null,
            main: null
        };
        this.#activeElement = null;
        this.#register = null;
        this.#login = null;
    }

    public render(): void {
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

    #attachEvents(): void {
        const moveToRegister = (e: Event) => {
            e.preventDefault();
            this.#register!.mount();
            this.#login!.unmount();
            this.#activeElement = this.#register;
            this.#saveState();
            this.update();
        };
        const moveToLogin = (e: Event) => {
            e.preventDefault();
            this.#register!.unmount();
            this.#login!.mount();
            this.#activeElement = this.#login;
            this.#saveState();
            this.update();
        };
        this.#elements.header!.loginBtn?.addEventListener('click', moveToLogin);
        this.#elements.header!.registerBtn?.addEventListener('click', moveToRegister);
        if (this.#register) {
            this.#register.goOutBtn?.addEventListener('click', moveToLogin);
        }
        if (this.#login) {
            this.#login.goToRegisterBtn?.addEventListener('click', moveToRegister);
        }
    }

    public update(): void {
        this.#activeElement!.update();
    }

    #saveState(): void {
        let activeView = REGISTER_STATE;
        if (this.#activeElement === this.#login) {
            activeView = LOGIN_STATE;
        }
        sessionStorage.setItem(
            SESSION_ACTIVE_STATE,
            JSON.stringify({
                activeView
            })
        );
    }

    #restoreState(): Login | Register {
        const urlMode = new URLSearchParams(window.location.search).get('mode');
        if (urlMode === LOGIN_STATE) return this.#login!;
        if (urlMode === REGISTER_STATE) return this.#register!;

        const savedState = sessionStorage.getItem(SESSION_ACTIVE_STATE);
        if (savedState) {
            try {
                const { activeView } = JSON.parse(savedState);
                return activeView === LOGIN_STATE ? this.#login! : this.#register!;
            } catch (_e) {
                return this.#register!;
            }
        } else {
            return this.#register!;
        }
    }

    public destroy(): void {
        if (this.#login) this.#login.unmount();
        if (this.#register) this.#register.unmount();
        this.#root.innerHTML = '';
    }
}
