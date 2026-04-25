/**
 * @module widgets/notebook-header/NotebookHeader
 */

import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { Router } from '../../shared/router/Router.js';
import { NotebookHeaderTemplate } from './NotebookHeader.template.js';

/** @typedef {import('../../shared/types.js').NotebookHeaderConfig} NotebookHeaderConfig */

/**
 * Header страницы ноутбука: логотип-ссылка на /files, редактируемое название,
 * user-pill с dropdown (профиль, выход).
 *
 * @extends BaseComponent
 */
export class NotebookHeader extends BaseComponent {
    /** @type {NotebookHeaderConfig} */
    #config;

    /** @type {?Function} */
    #onRename;

    /** @type {?Function} */
    #onShare;

    /** @type {string} */
    #originalText = '';

    /** @type {boolean} */
    #isEditing = false;

    /** @type {boolean} */
    #isDropdownOpen = false;

    /** @type {boolean} */
    #isMenuOpen = false;

    /**
     * @param {HTMLElement} parent
     * @param {NotebookHeaderConfig} [config={}]
     */
    constructor(parent, config = {}) {
        super(null, parent);
        this.#config = config;
        this.#onRename = config.onRename || null;
        this.#onShare = config.onShare || null;
        this.#render();
    }

    /**
     * Компилирует Handlebars-шаблон NotebookHeader с названием файла и данными пользователя.
     *
     * @private
     */
    #render() {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = NotebookHeaderTemplate({
            filename: this.#config.filename || 'Untitled',
            user: this.#config.user || null,
            isOwner: this.#config.isOwner ?? true
        });
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    unmount() {
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Обновить отображаемое название файла. Игнорируется, если пользователь
     * сейчас редактирует заголовок (чтобы не перебивать его ввод).
     * @param {string} filename
     */
    setFilename(filename) {
        if (this.#isEditing) return;
        const span = this._element.querySelector('.notebook-header__filename');
        if (span) span.textContent = filename;
    }

    /**
     * Подключает обработчики: навигация по логотипу на /files, кнопка редактирования названия, user-pill dropdown с действиями профиль/выход.
     *
     * @private
     */
    #attachEvents() {
        const logoLink = this._element.querySelector('.notebook-header__logo-link');
        this._addListener(logoLink, 'click', async (e) => {
            e.preventDefault();
            await this.#finishEditing();
            Router.getInstance().navigate('/files');
        });

        const editBtn = this._element.querySelector('.notebook-header__edit-btn');
        this._addListener(editBtn, 'click', () => {
            this.#startRename();
        });

        const shareBtn = this._element.querySelector('.notebook-header__share-btn');
        if (shareBtn && this.#onShare) {
            this._addListener(shareBtn, 'click', () => {
                this.#onShare();
            });
        }

        const menuBtn = this._element.querySelector('[data-menu="file"]');
        if (menuBtn) {
            this._addListener(menuBtn, 'click', (e) => {
                e.stopPropagation();
                this.#toggleMenu();
            });

            this._addListener(document, 'click', () => {
                if (this.#isMenuOpen) this.#closeMenu();
            });
        }

        const pill = this._element.querySelector('.notebook-header__user-pill');
        if (pill) {
            this._addListener(pill, 'click', (e) => {
                e.stopPropagation();
                this.#toggleDropdown();
            });

            this._addListener(document, 'click', () => {
                if (this.#isDropdownOpen) this.#closeDropdown();
            });

            const dropdown = this._element.querySelector('.notebook-header__user-dropdown');
            if (dropdown) {
                this._addListener(dropdown, 'click', (e) => {
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
        }
    }

    /**
     * Завершает inline-редактирование: если название изменилось, вызывает onRename.
     *
     * @private
     * @async
     */
    async #finishEditing() {
        if (!this.#isEditing) return;

        const filenameSpan = this._element.querySelector('.notebook-header__filename');
        this.#isEditing = false;
        filenameSpan.contentEditable = 'false';
        filenameSpan.classList.remove('notebook-header__filename--editing');

        const newTitle = filenameSpan.textContent.trim();
        if (!newTitle) {
            filenameSpan.textContent = this.#originalText;
        } else if (newTitle !== this.#originalText && this.#onRename) {
            await this.#onRename(newTitle);
        }
    }

    /**
     * Переключает видимость user dropdown.
     *
     * @private
     */
    #toggleMenu() {
        this.#isMenuOpen ? this.#closeMenu() : this.#openMenu();
    }

    #openMenu() {
        this.#isMenuOpen = true;
        this._element
            .querySelector('.notebook-header__dropdown')
            .classList.add('notebook-header__dropdown--open');
        this._element
            .querySelector('[data-menu="file"]')
            .classList.add('notebook-header__menu-item--active');
    }

    #closeMenu() {
        this.#isMenuOpen = false;
        this._element
            .querySelector('.notebook-header__dropdown')
            .classList.remove('notebook-header__dropdown--open');
        this._element
            .querySelector('[data-menu="file"]')
            .classList.remove('notebook-header__menu-item--active');
    }

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
        this._element
            .querySelector('.notebook-header__user-dropdown')
            .classList.add('header-user-dropdown_visible');
    }

    /**
     * Скрывает user dropdown, убирая CSS-модификатор видимости.
     *
     * @private
     */
    #closeDropdown() {
        this.#isDropdownOpen = false;
        this._element
            .querySelector('.notebook-header__user-dropdown')
            .classList.remove('header-user-dropdown_visible');
    }

    /**
     * Включает inline-редактирование названия: делает span contentEditable,
     * выделяет текст и навешивает разовые обработчики Enter/Escape/blur.
     *
     * @private
     */
    #startRename() {
        const filenameSpan = this._element.querySelector('.notebook-header__filename');
        this.#originalText = filenameSpan.textContent;
        this.#isEditing = true;

        filenameSpan.contentEditable = 'true';
        filenameSpan.classList.add('notebook-header__filename--editing');
        filenameSpan.focus();

        const range = document.createRange();
        range.selectNodeContents(filenameSpan);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const controller = new AbortController();

        filenameSpan.addEventListener(
            'keydown',
            (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    filenameSpan.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    controller.abort();
                    this.#isEditing = false;
                    filenameSpan.contentEditable = 'false';
                    filenameSpan.classList.remove('notebook-header__filename--editing');
                    filenameSpan.textContent = this.#originalText;
                }
            },
            { signal: controller.signal }
        );

        filenameSpan.addEventListener(
            'blur',
            () => {
                controller.abort();
                this.#finishEditing();
            },
            { signal: controller.signal }
        );
    }
}
