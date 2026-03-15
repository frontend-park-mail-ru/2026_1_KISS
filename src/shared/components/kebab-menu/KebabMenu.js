/**
 * @module shared/components/kebab-menu/KebabMenu
 */

import { BaseComponent } from '../base-component/BaseComponent.js';

/** @typedef {import('../../types.js').KebabAction} KebabAction */

/**
 * Контекстное меню-«кебаб» (три точки) с выпадающим списком действий.
 * Закрывается при клике вне меню или при выборе пункта.
 *
 * @extends BaseComponent
 */
export class KebabMenu extends BaseComponent {
    /** @type {KebabAction[]} */
    #actions;

    /** @type {boolean} */
    #isOpen = false;

    /**
     * @param {HTMLElement} parent -- контейнер для mount
     * @param {KebabAction[]} actions -- список действий меню
     */
    constructor(parent, actions) {
        super(null, parent);
        this.#actions = actions;
        this.#render();
    }

    /**
     * Компилирует Handlebars-шаблон KebabMenu со списком действий.
     *
     * @private
     */
    #render() {
        const template = Handlebars.templates['KebabMenu'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template({ actions: this.#actions });
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    unmount() {
        if (!this._isMounted) return;
        this.#isOpen = false;
        super.unmount();
    }

    /**
     * Подключает обработчики: toggle по trigger-кнопке, закрытие по клику вне, вызов handler при выборе пункта по data-action.
     *
     * @private
     */
    #attachEvents() {
        const trigger = this._element.querySelector('.kebab-menu__trigger');
        this._addListener(trigger, 'click', (e) => {
            e.stopPropagation();
            this.#toggle();
        });

        this._addListener(document, 'click', () => {
            if (this.#isOpen) this.#close();
        });

        const dropdown = this._element.querySelector('.kebab-menu__dropdown');
        this._addListener(dropdown, 'click', (e) => {
            const item = e.target.closest('[data-action]');
            if (!item) return;
            const action = this.#actions.find((a) => a.name === item.dataset.action);
            if (action && action.handler) action.handler();
            this.#close();
        });
    }

    /**
     * Переключает видимость dropdown меню.
     *
     * @private
     */
    #toggle() {
        this.#isOpen ? this.#close() : this.#open();
    }

    /**
     * Показывает dropdown меню, добавляя CSS-модификатор видимости.
     *
     * @private
     */
    #open() {
        this.#isOpen = true;
        this._element
            .querySelector('.kebab-menu__dropdown')
            .classList.add('kebab-menu__dropdown_visible');
    }

    /**
     * Скрывает dropdown меню, убирая CSS-модификатор видимости.
     *
     * @private
     */
    #close() {
        this.#isOpen = false;
        this._element
            .querySelector('.kebab-menu__dropdown')
            .classList.remove('kebab-menu__dropdown_visible');
    }
}
