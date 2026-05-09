import { GreenHeaderTemplate } from './GreenHeader.template.js';
import type { EventListenerRecord } from '../../shared/types.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Данные пользователя для отображения в user-pill шапки.
 */
interface HeaderUser {
    /** URL аватара (опционально — если нет, показываются инициалы) */
    avatarUrl?: string;
    /** Инициалы (две буквы) для дефолтного аватара */
    initials: string;
    /** Логин для отображения */
    username: string;
}

/**
 * Конфиг GreenHeader: либо user (для авторизованных), либо buttons (для гостей).
 */
interface GreenHeaderConfig {
    /** Путь к логотипу (по умолчанию NewLogoTransparentWhite.svg) */
    logo?: string;
    /** Данные пользователя — если задан, показывается user-pill */
    user?: HeaderUser;
    /** Кнопки для гостей (Войти/Регистрация) */
    buttons?: { text: string; class: string; action: string }[];
    /** Обработчик клика по "Профиль" в dropdown'е */
    onProfile?: (() => void) | null;
    /** Обработчик клика по "Выйти" в dropdown'е */
    onLogout?: (() => void) | null;
    /** Обработчик клика по "Админ-панель" (показывается только если задан) */
    onAdmin?: (() => void) | null;
    /** Обработчик клика по "Обратная связь" в dropdown'е */
    onFeedback?: (() => void) | null;
}

/**
 * Зелёная шапка приложения. В отличие от BaseComponent, использует прямую
 * вставку через insertAdjacentHTML (а не append) и собственный listener-реестр —
 * это легаси-паттерн от старой версии шапки, который пока не приведён к BaseComponent.
 *
 * Поведение зависит от config: с user — user-pill + dropdown с действиями,
 * без user — кнопки Войти/Регистрация.
 */
export class GreenHeader {
    #parent: HTMLElement;
    #config: GreenHeaderConfig;
    #header!: HTMLElement;
    #isDropdownOpen = false;
    #listeners: EventListenerRecord[] = [];

    /**
     * Подготавливает конфиг (выставляет дефолты для logo, фоллбэчит на гостевые
     * кнопки если user не задан). Реальный рендер откладывается до render().
     * @param parent - родительский элемент
     * @param config - параметры шапки (см. GreenHeaderConfig)
     */
    public constructor(parent: HTMLElement, config: GreenHeaderConfig = {}) {
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

        this.#config.onProfile = config.onProfile ?? null;
        this.#config.onLogout = config.onLogout ?? null;
        this.#config.onAdmin = config.onAdmin ?? null;
        this.#config.onFeedback = config.onFeedback ?? null;
    }

    /**
     * Вставляет шапку в начало parent через insertAdjacentHTML и навешивает
     * обработчики dropdown'а. Можно вызывать только один раз — повторный
     * добавит вторую шапку.
     */
    public render(): void {
        this.#parent.insertAdjacentHTML(
            'afterbegin',
            GreenHeaderTemplate(this.#config as Parameters<typeof GreenHeaderTemplate>[0])
        );
        this.#header = nn(this.#parent.querySelector('.green-header'));
        this.#attachDropdownEvents();
    }

    /**
     * Навешивает обработчики: клик по pill (toggle dropdown), document-click
     * (close on outside click), делегированный click по dropdown (вызов action-handler).
     */
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
            const item = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
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

    /**
     * Переключает состояние dropdown'а user-меню.
     */
    #toggleDropdown(): void {
        if (this.#isDropdownOpen) {
            this.#closeDropdown();
        } else {
            this.#openDropdown();
        }
    }

    /**
     * Открывает dropdown user-меню (CSS-класс).
     */
    #openDropdown(): void {
        this.#isDropdownOpen = true;
        nn(this.#header.querySelector('.header-user-dropdown')).classList.add(
            'header-user-dropdown_visible'
        );
    }

    /**
     * Закрывает dropdown user-меню.
     */
    #closeDropdown(): void {
        this.#isDropdownOpen = false;
        nn(this.#header.querySelector('.header-user-dropdown')).classList.remove(
            'header-user-dropdown_visible'
        );
    }

    /**
     * Регистрирует обработчик и сохраняет запись для последующего snimanия в destroy.
     * Локальная замена _addListener из BaseComponent (не наследуется).
     * @param element - целевой EventTarget
     * @param event - имя события
     * @param handler - функция-обработчик
     */
    #addListener(element: EventTarget, event: string, handler: EventListener): void {
        element.addEventListener(event, handler);
        this.#listeners.push({ element, event, handler });
    }

    /**
     * Снимает все навешанные обработчики. Шапка из DOM не удаляется (родитель
     * сам это делает при перерисовке страницы) — здесь только cleanup listener'ов.
     */
    public destroy(): void {
        this.#listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.#listeners = [];
    }

    /**
     * Геттер кнопки "Войти" (для гостевых страниц).
     * @returns DOM-элемент кнопки или null если шапка для авторизованного
     */
    public get loginBtn(): HTMLElement | null {
        return this.#header.querySelector('[data-action="login"]');
    }

    /**
     * Геттер кнопки "Регистрация" (для гостевых страниц).
     * @returns DOM-элемент кнопки или null если шапка для авторизованного
     */
    public get registerBtn(): HTMLElement | null {
        return this.#header.querySelector('[data-action="register"]');
    }
}
