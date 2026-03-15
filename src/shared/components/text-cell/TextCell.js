/**
 * @module shared/components/text-cell/TextCell
 */

import { BaseComponent } from '../base-component/BaseComponent.js';

/** @typedef {import('../../types.js').BlockData} BlockData */

/**
 * Текстовая ячейка (markdown/plain text) с кнопками перемещения и копирования.
 *
 * @extends BaseComponent
 */
export class TextCell extends BaseComponent {
    /** @type {BlockData} */
    #blockData;

    /** @type {Function} */
    #onMoveUp;

    /** @type {Function} */
    #onMoveDown;

    /** @type {Function} */
    #onCopy;

    /**
     * @param {HTMLElement} parent
     * @param {Object} options
     * @param {BlockData} options.blockData -- данные блока (id + content)
     * @param {Function} [options.onMoveUp] -- вызывается при перемещении вверх
     * @param {Function} [options.onMoveDown] -- вызывается при перемещении вниз
     * @param {Function} [options.onCopy] -- вызывается при копировании
     */
    constructor(parent, { blockData, onMoveUp, onMoveDown, onCopy }) {
        super(null, parent);
        this.#blockData = blockData;
        this.#onMoveUp = onMoveUp;
        this.#onMoveDown = onMoveDown;
        this.#onCopy = onCopy;
        this.#render();
    }

    /** @private */
    #render() {
        const template = Handlebars.templates['TextCell'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template({
            id: this.#blockData.id,
            content: this.#blockData.content || ''
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

    /** @private */
    #attachEvents() {
        this._element.querySelectorAll('.text-cell__action-btn').forEach((btn) => {
            const action = btn.dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'move-up' && this.#onMoveUp) this.#onMoveUp(this.#blockData.id);
                if (action === 'move-down' && this.#onMoveDown)
                    this.#onMoveDown(this.#blockData.id);
                if (action === 'copy' && this.#onCopy) this.#onCopy(this.#blockData.id);
            });
        });
    }

    /**
     * @returns {string} текстовое содержимое ячейки
     */
    getContent() {
        return this._element.querySelector('.text-cell__content').textContent;
    }

    /**
     * @returns {string} идентификатор блока
     */
    getBlockId() {
        return this.#blockData.id;
    }
}
