import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { Register } from '../../widgets/register-form/Register.js';
import { Login } from '../../widgets/login-form/Login.js';
import { nn } from '../../shared/utils/notNull.js';
import { translateError } from '../../shared/utils/serverErrors.js';

const SESSION_ACTIVE_STATE = 'registerPageState';
const LOGIN_STATE = 'login';
const REGISTER_STATE = 'register';
const VERIFIED_SUCCESS_MESSAGE = 'Email подтверждён. Теперь вы можете войти.';

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
    #banner: HTMLElement | null = null;

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

        this.#banner = document.createElement('div');
        this.#banner.className = 'sign-banner sign-banner--hidden';
        this.#banner.setAttribute('role', 'status');
        containerMain.appendChild(this.#banner);

        this.#register = new Register(containerMain);
        this.#login = new Login(containerMain);
        this.#activeElement = this.#applyQueryParams() ?? this.#restoreState();
        this.#activeElement.mount();
        this.#attachEvents();
    }

    /**
     * Обрабатывает query-параметры, оставленные бэкендом после редиректа с
     * `/api/v1/auth/confirm`: `?error=invalid_token` или `?verified=1`.
     * При наличии параметра показывает баннер с соответствующим сообщением,
     * принудительно выбирает форму (Register при ошибке, Login при успехе)
     * и очищает URL через `history.replaceState`, чтобы баннер не вернулся
     * при перезагрузке страницы. Возвращает null, если параметры отсутствуют.
     * @returns форма для принудительного показа либо null, если query пустой
     */
    #applyQueryParams(): Login | Register | null {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        const verified = params.get('verified');
        const oauthError = params.get('oauth_error');

        if (oauthError !== null && oauthError !== '') {
            this.#showBanner(translateError(oauthError), 'error');
            this.#cleanQueryString();
            return nn(this.#login);
        }
        if (error !== null && error !== '') {
            this.#showBanner(translateError(error), 'error');
            this.#cleanQueryString();
            return nn(this.#register);
        }
        if (verified === '1') {
            this.#showBanner(VERIFIED_SUCCESS_MESSAGE, 'success');
            this.#cleanQueryString();
            return nn(this.#login);
        }
        return null;
    }

    /**
     * Наполняет баннер текстом и применяет цветовой модификатор (error/success).
     * Баннер всегда создаётся скрытым; этот метод снимает класс sign-banner--hidden.
     * @param message - локализованный текст для пользователя
     * @param tone - визуальный тон баннера ('error' для красного, 'success' для зелёного)
     */
    #showBanner(message: string, tone: 'error' | 'success'): void {
        const banner = nn(this.#banner);
        banner.textContent = message;
        banner.classList.remove('sign-banner--hidden');
        banner.classList.remove('sign-banner--error');
        banner.classList.remove('sign-banner--success');
        banner.classList.add(`sign-banner--${tone}`);
    }

    /**
     * Заменяет текущий URL на `/sign` без query-строки и без записи новой
     * History-entry. Нужен чтобы после показа баннера обновление страницы
     * (F5) не возвращало пользователю всплывающее сообщение об уже
     * прочитанной ошибке/успехе подтверждения email.
     */
    #cleanQueryString(): void {
        const pathname = window.location.pathname || '/sign';
        history.replaceState(null, '', pathname);
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
        const pathname = window.location.pathname;
        if (pathname === '/login') return nn(this.#login);
        if (pathname === '/register') return nn(this.#register);

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
