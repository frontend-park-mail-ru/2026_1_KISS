import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { Register } from '../../widgets/register-form/Register.js';
import { Login } from '../../widgets/login-form/Login.js';
import { nn } from '../../shared/utils/notNull.js';

const SESSION_ACTIVE_STATE = 'registerPageState';
const LOGIN_STATE = 'login';
const REGISTER_STATE = 'register';

/**
 * Объединённая страница входа и регистрации (`/sign`). На одном экране держит
 * оба компонента (Register и Login), показывает один из них в зависимости от:
 * 1) URL `?mode=login` или `?mode=register` (наивысший приоритет),
 * 2) sessionStorage (последний выбор пользователя),
 * 3) Register по умолчанию.
 *
 * Переключение между формами не пересоздаёт компоненты — просто mount/unmount.
 * Переключение происходит через кнопки внутри форм (goOutBtn/goToRegisterBtn) и
 * через шапку (loginBtn/registerBtn).
 */
export class RegisterPage {
    #root: HTMLElement;
    #elements: { header: GreenHeader | null; main: HTMLElement | null };
    #activeElement: Login | Register | null;
    #register: Register | null;
    #login: Login | null;

    /**
     * Инициализирует пустые ссылки. Реальные компоненты создаются в render().
     * @param root - корневой элемент SPA
     */
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

    /**
     * Создаёт DOM-структуру (шапка + main + container), инстанцирует обе формы,
     * восстанавливает active-форму через #restoreState и монтирует её.
     */
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

    /**
     * Навешивает 4 обработчика переключения форм (login/register × header/inline-link).
     * Каждое переключение размонтирует одну форму, монтирует другую, сохраняет
     * выбор в sessionStorage и зовёт update.
     */
    #attachEvents(): void {
        const moveToRegister = (e: Event): void => {
            e.preventDefault();
            nn(this.#register).mount();
            nn(this.#login).unmount();
            this.#activeElement = this.#register;
            this.#saveState();
            this.update();
        };
        const moveToLogin = (e: Event): void => {
            e.preventDefault();
            nn(this.#register).unmount();
            nn(this.#login).mount();
            this.#activeElement = this.#login;
            this.#saveState();
            this.update();
        };
        nn(this.#elements.header).loginBtn?.addEventListener('click', moveToLogin);
        nn(this.#elements.header).registerBtn?.addEventListener('click', moveToRegister);
        if (this.#register) {
            this.#register.goOutBtn?.addEventListener('click', moveToLogin);
        }
        if (this.#login) {
            this.#login.goToRegisterBtn?.addEventListener('click', moveToRegister);
        }
    }

    /**
     * Сбрасывает значения активной формы. Внешний API — может вызываться роутером
     * (например при возврате с back-кнопки) для очистки полей.
     */
    public update(): void {
        nn(this.#activeElement).update();
    }

    /**
     * Сохраняет текущий выбор формы в sessionStorage чтобы при F5 показать ту же.
     */
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

    /**
     * Определяет какую форму показать при заходе: сначала смотрит ?mode= в URL,
     * затем sessionStorage, fallback — Register.
     * @returns форма для показа
     */
    #restoreState(): Login | Register {
        const urlMode = new URLSearchParams(window.location.search).get('mode');
        if (urlMode === LOGIN_STATE) return nn(this.#login);
        if (urlMode === REGISTER_STATE) return nn(this.#register);

        const savedState = sessionStorage.getItem(SESSION_ACTIVE_STATE);
        if (savedState !== null) {
            try {
                const parsed = JSON.parse(savedState) as { activeView?: string };
                return parsed.activeView === LOGIN_STATE ? nn(this.#login) : nn(this.#register);
            } catch (_e) {
                return nn(this.#register);
            }
        } else {
            return nn(this.#register);
        }
    }

    /**
     * Размонтирует обе формы (вне зависимости от того какая активна) и очищает
     * root. Вызывается роутером при навигации.
     */
    public destroy(): void {
        if (this.#login) this.#login.unmount();
        if (this.#register) this.#register.unmount();
        this.#root.innerHTML = '';
    }
}
