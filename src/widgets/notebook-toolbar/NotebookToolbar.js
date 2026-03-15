/**
 * @module widgets/notebook-toolbar/NotebookToolbar
 */

import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';

/**
 * Панель инструментов ноутбука: кнопки «+ Code», «+ Text», «Run All».
 *
 * @extends BaseComponent
 */
export class NotebookToolbar extends BaseComponent {
    /** @type {Function} */
    #onAddCode;

    /** @type {Function} */
    #onAddText;

    /** @type {Function} */
    #onRunAll;

    /**
     * @param {HTMLElement} parent
     * @param {Object} callbacks
     * @param {Function} callbacks.onAddCode -- добавить code-ячейку
     * @param {Function} callbacks.onAddText -- добавить text-ячейку
     * @param {Function} callbacks.onRunAll -- запустить все ячейки
     */
    constructor(parent, { onAddCode, onAddText, onRunAll }) {
        super(null, parent);
        this.#onAddCode = onAddCode;
        this.#onAddText = onAddText;
        this.#onRunAll = onRunAll;
        this.#render();
    }

    /** @private */
    #render() {
        const template = Handlebars.templates['NotebookToolbar'];
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

    /** @private */
    #attachEvents() {
        this._element.querySelectorAll('.notebook-toolbar__btn').forEach((btn) => {
            const action = btn.dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'add-code' && this.#onAddCode) this.#onAddCode();
                if (action === 'add-text' && this.#onAddText) this.#onAddText();
                if (action === 'run-all' && this.#onRunAll) this.#onRunAll();
            });
        });
    }
}
