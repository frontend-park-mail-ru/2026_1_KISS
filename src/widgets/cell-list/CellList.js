import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { CodeCell } from '../../shared/components/code-cell/CodeCell.js';
import { TextCell } from '../../shared/components/text-cell/TextCell.js';

export class CellList extends BaseComponent {
    #cells = [];
    #blocks = [];

    constructor(parent) {
        super(null, parent);
        this.#render();
    }

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
}
