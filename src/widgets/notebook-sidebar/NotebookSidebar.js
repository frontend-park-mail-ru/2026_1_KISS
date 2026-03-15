/**
 * @module widgets/notebook-sidebar/NotebookSidebar
 */

import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';

/**
 * Боковая панель ноутбука с иконками-кнопками.
 * Открывает/закрывает панели по клику (toggle-логика).
 *
 * @extends BaseComponent
 */
export class NotebookSidebar extends BaseComponent {
    /** @type {?string} */
    #activePanel = null;

    /**
     * @param {HTMLElement} parent
     */
    constructor(parent) {
        super(null, parent);
        this.#render();
    }

    /**
     * Компилирует Handlebars-шаблон NotebookSidebar и создаёт корневой DOM-элемент боковой панели.
     *
     * @private
     */
    #render() {
        const template = Handlebars.templates['NotebookSidebar'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template({});
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
     * Подключает toggle-обработчики на кнопки sidebar: открытие/закрытие панелей по data-panel атрибуту.
     *
     * @private
     */
    #attachEvents() {
        this._element.querySelectorAll('.notebook-sidebar__icon-btn').forEach((btn) => {
            this._addListener(btn, 'click', () => {
                const panel = btn.dataset.panel;
                if (this.#activePanel === panel) {
                    this.#closePanel();
                } else {
                    this.#openPanel(panel);
                }
            });
        });

        this._element.querySelectorAll('.notebook-sidebar__link').forEach((link) => {
            this._addListener(link, 'click', (e) => {
                e.preventDefault();
            });
        });
    }

    /**
     * @private
     * @param {string} panelName -- имя панели из data-panel
     */
    #openPanel(panelName) {
        this.#closePanel();
        this.#activePanel = panelName;

        const btn = this._element.querySelector(`[data-panel="${panelName}"]`);
        if (btn) btn.classList.add('notebook-sidebar__icon-btn--active');

        const panel = this._element.querySelector(`.notebook-sidebar__panel--${panelName}`);
        if (panel) panel.classList.add('notebook-sidebar__panel--visible');
    }

    /**
     * Деактивирует текущую открытую панель: убирает CSS-классы active/visible и сбрасывает #activePanel.
     *
     * @private
     */
    #closePanel() {
        if (!this.#activePanel) return;

        const btn = this._element.querySelector(`[data-panel="${this.#activePanel}"]`);
        if (btn) btn.classList.remove('notebook-sidebar__icon-btn--active');

        const panel = this._element.querySelector(`.notebook-sidebar__panel--${this.#activePanel}`);
        if (panel) panel.classList.remove('notebook-sidebar__panel--visible');

        this.#activePanel = null;
    }
}
