/**
 * @module widgets/cell-list/CellList
 */

import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { CodeCell } from '../../shared/components/code-cell/CodeCell.js';
import { TextCell } from '../../shared/components/text-cell/TextCell.js';

/** @typedef {import('../../shared/types.js').BlockData} BlockData */

/**
 * Контейнер ячеек ноутбука. Управляет списком CodeCell/TextCell,
 * их перемещением и копированием содержимого.
 *
 * @extends BaseComponent
 */
export class CellList extends BaseComponent {
    /** @type {(CodeCell|TextCell)[]} */
    #cells = [];

    /** @type {BlockData[]} */
    #blocks = [];

    /**
     * @param {HTMLElement} parent
     */
    constructor(parent) {
        super(null, parent);
        this.#render();
    }

    /**
     * Компилирует Handlebars-шаблон CellList и создаёт корневой DOM-элемент контейнера ячеек.
     *
     * @private
     */
    #render() {
        const template = Handlebars.templates['CellList'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template({});
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
    }

    unmount() {
        this.#clearCells();
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Заменяет все ячейки новым набором блоков.
     * Очищает предыдущие, создаёт CodeCell/TextCell по типу и монтирует.
     *
     * @param {BlockData[]} blocks -- массив данных блоков
     */
    updateBlocks(blocks) {
        this.#clearCells();
        this.#blocks = [...blocks];

        const container = this._element.querySelector('.cell-list__cells');
        const emptyState = this._element.querySelector('.cell-list__empty-state');

        if (blocks.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = '';
            return;
        }

        container.style.display = '';
        emptyState.style.display = 'none';

        blocks.forEach((block) => {
            const cellCallbacks = {
                blockData: block,
                onMoveUp: (id) => this.#moveBlock(id, -1),
                onMoveDown: (id) => this.#moveBlock(id, 1),
                onCopy: (id) => this.#copyBlock(id)
            };

            let cell;
            if (block.type === 'code') {
                cell = new CodeCell(container, {
                    ...cellCallbacks,
                    onRun: () => {}
                });
            } else {
                cell = new TextCell(container, cellCallbacks);
            }

            cell.mount();
            this.#cells.push(cell);
        });
    }

    /**
     * Добавляет блок в конец списка и перерисовывает все ячейки.
     *
     * @param {BlockData} blockData
     */
    addBlock(blockData) {
        this.#blocks.push(blockData);
        this.updateBlocks(this.#blocks);
    }

    /**
     * Меняет позицию блока на +-1 и перерисовывает список.
     *
     * @private
     * @param {string} id -- идентификатор перемещаемого блока
     * @param {number} direction -- направление (-1 вверх, +1 вниз)
     */
    #moveBlock(id, direction) {
        const index = this.#blocks.findIndex((b) => b.id === id);
        if (index < 0) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.#blocks.length) return;

        const temp = this.#blocks[index];
        this.#blocks[index] = this.#blocks[newIndex];
        this.#blocks[newIndex] = temp;

        this.updateBlocks(this.#blocks);
    }

    /**
     * Копирует содержимое блока в буфер обмена.
     *
     * @private
     * @param {string} id -- идентификатор блока
     */
    #copyBlock(id) {
        const block = this.#blocks.find((b) => b.id === id);
        if (!block) return;

        const cell = this.#cells.find((c) => c.getBlockId() === id);
        if (!cell) return;

        const content = cell.getContent();
        navigator.clipboard.writeText(content).catch(() => {});
    }

    /**
     * Размонтирует все ячейки (CodeCell/TextCell) и очищает внутренний массив.
     *
     * @private
     */
    #clearCells() {
        this.#cells.forEach((cell) => cell.unmount());
        this.#cells = [];
    }
}
