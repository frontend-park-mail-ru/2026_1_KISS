import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { CellListTemplate } from './CellList.template.js';
import { CodeCell } from '../../shared/components/code-cell/CodeCell.js';
import { TextCell } from '../../shared/components/text-cell/TextCell.js';

export class CellList extends BaseComponent {
    #cells = [];
    #blocks = [];
    #onRunCell;
    #onRerender;

    constructor(parent, { onRunCell, onRerender } = {}) {
        super(null, parent);
        this.#onRunCell = onRunCell;
        this.#onRerender = onRerender;
        this.#render();
    }

    #render() {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = CellListTemplate({});
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

    updateBlocks(blocks) {
        this.#clearCells();
        this.#blocks = [...blocks];

        const container = this._element.querySelector('.cell-list__cells');
        const emptyState = this._element.querySelector('.cell-list__empty-state');

        if (blocks.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = '';
            if (this.#onRerender) this.#onRerender();
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
                    onRun: (id) => {
                        if (this.#onRunCell) this.#onRunCell(id);
                    }
                });
            } else {
                cell = new TextCell(container, cellCallbacks);
            }

            cell.mount();
            this.#cells.push(cell);
        });

        if (this.#onRerender) this.#onRerender();
    }

    addBlock(blockData) {
        this.#blocks.push(blockData);
        this.updateBlocks(this.#blocks);
    }

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

    #copyBlock(id) {
        const block = this.#blocks.find((b) => b.id === id);
        if (!block) return;

        const cell = this.#cells.find((c) => c.getBlockId() === id);
        if (!cell) return;

        const content = cell.getContent();
        navigator.clipboard.writeText(content).catch(() => {});
    }

    #clearCells() {
        this.#cells.forEach((cell) => cell.unmount());
        this.#cells = [];
    }

    /**
     * Найти ячейку по id блока.
     * @param {number|string} id
     * @returns {CodeCell|TextCell|null}
     */
    getCellByBlockId(id) {
        return this.#cells.find((c) => c.getBlockId() === id) || null;
    }

    /**
     * Вернуть копию списка всех ячеек.
     * @returns {Array<CodeCell|TextCell>}
     */
    getAllCells() {
        return [...this.#cells];
    }

    /**
     * Вернуть только code-ячейки в порядке позиций.
     * @returns {CodeCell[]}
     */
    getCodeCellsInOrder() {
        return this.#cells.filter((c) => c instanceof CodeCell);
    }

    /**
     * Позиция блока в списке (0-индексированная). Соответствует backend `block_position`.
     * @param {number|string} id
     * @returns {number} -1 если не найдено
     */
    getBlockPositionById(id) {
        return this.#blocks.findIndex((b) => b.id === id);
    }
}
