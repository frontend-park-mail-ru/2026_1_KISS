/**
 * @module shared/components/text-cell/TextCell
 */

import { BaseComponent } from '../base-component/BaseComponent.js';
import { TextCellTemplate } from './TextCell.template.js';

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

    /**
     * Компилирует Handlebars-шаблон TextCell с идентификатором и содержимым блока.
     *
     * @private
     */
    #render() {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = TextCellTemplate({
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

    /**
     * Подключает обработчики кнопок действий: move-up, move-down, copy по data-action атрибуту.
     *
     * @private
     */
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

    setContent(text) {
        this._element.querySelector('.text-cell__content').textContent = text;
    }

    highlightMatch(_matchIndex, start, end) {
        const el = this._element.querySelector('.text-cell__content');
        const raw = el.textContent;
        const before = raw.substring(0, start);
        const matchText = raw.substring(start, end);
        const after = raw.substring(end);
        el.innerHTML = '';
        el.appendChild(document.createTextNode(before));
        const mark = document.createElement('mark');
        mark.className = 'find-match find-match--current';
        mark.textContent = matchText;
        el.appendChild(mark);
        el.appendChild(document.createTextNode(after));
        this._element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    clearHighlights() {
        const el = this._element.querySelector('.text-cell__content');
        el.querySelectorAll('mark.find-match').forEach((m) => {
            m.replaceWith(document.createTextNode(m.textContent));
        });
        el.normalize();
    }

    getBlockId() {
        return this.#blockData.id;
    }
}
