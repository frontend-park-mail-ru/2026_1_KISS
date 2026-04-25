import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { CellListTemplate } from './CellList.template.js';
import { CodeCell } from '../../shared/components/code-cell/CodeCell.js';
import { TextCell } from '../../shared/components/text-cell/TextCell.js';

export class CellList extends BaseComponent {
    #cells = [];
    #blocks = [];
    #onRunCell;
    #onRerender;
    #onDeleteCell;
    #onSaveContent;
    #onCodeContentChange;

    constructor(
        parent,
        { onRunCell, onRerender, onDeleteCell, onSaveContent, onCodeContentChange } = {}
    ) {
        super(null, parent);
        this.#onRunCell = onRunCell;
        this.#onRerender = onRerender;
        this.#onDeleteCell = onDeleteCell;
        this.#onSaveContent = onSaveContent;
        this.#onCodeContentChange = onCodeContentChange;
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
            const cell = this.#createCell(container, block, this.#buildCellCallbacks(block));
            cell.mount();
            this.#cells.push(cell);
        });

        if (this.#onRerender) this.#onRerender();
    }

    /**
     * Создать ячейку соответствующего типа.
     * @private
     */
    #createCell(container, block, cellCallbacks) {
        if (block.type === 'code') {
            return new CodeCell(container, {
                ...cellCallbacks,
                onRun: (id) => {
                    if (this.#onRunCell) this.#onRunCell(id);
                },
                onContentChange: (id, content) => {
                    if (this.#onCodeContentChange) this.#onCodeContentChange(id, content);
                }
            });
        }
        return new TextCell(container, {
            ...cellCallbacks,
            onContentChange: (id, content) => {
                if (this.#onSaveContent) this.#onSaveContent(id, content);
            }
        });
    }

    #buildCellCallbacks(block) {
        return {
            blockData: block,
            onMoveUp: (id) => this.#moveBlock(id, -1),
            onMoveDown: (id) => this.#moveBlock(id, 1),
            onCopy: (id) => this.#copyBlock(id),
            onDelete: (id) => {
                if (this.#onDeleteCell) this.#onDeleteCell(id);
            }
        };
    }

    /**
     * Применить событие сервера: добавить, обновить или удалить ячейку.
     * Не делает полный re-render — сохраняет фокус и каретку в других ячейках.
     *
     * @param {{type: 'block_added'|'block_updated'|'block_deleted', block?: object, block_id?: number}} event
     */
    applyRemoteEvent(event) {
        if (!event) return;
        if (event.type === 'block_updated' && event.block) {
            this.#applyBlockUpdated(event.block);
        } else if (event.type === 'block_added' && event.block) {
            this.#applyBlockAdded(event.block);
        } else if (event.type === 'block_deleted' && event.block_id !== undefined && event.block_id !== null) {
            this.#applyBlockDeleted(event.block_id);
        }
    }

    #applyBlockUpdated(block) {
        const idx = this.#blocks.findIndex((b) => b.id === block.id);
        if (idx < 0) {
            // Не знали про блок — поведём себя как при добавлении
            this.#applyBlockAdded(block);
            return;
        }
        this.#blocks[idx] = { ...this.#blocks[idx], ...block };
        const cell = this.getCellByBlockId(block.id);
        if (!cell) return;

        // Не переписываем активный editor — иначе собьём каретку у того,
        // кто сейчас печатает в этой же ячейке (актор уже отфильтрован
        // BlocksPage по actor_id, но на всякий случай ещё проверяем фокус).
        const root = cell._element;
        if (root && root.contains(document.activeElement)) return;

        if (typeof cell.setContent === 'function') {
            cell.setContent(block.content || '');
        }
    }

    #applyBlockAdded(block) {
        if (this.#blocks.some((b) => b.id === block.id)) return;
        const insertAt =
            typeof block.position === 'number' &&
            block.position >= 0 &&
            block.position < this.#blocks.length
                ? block.position
                : this.#blocks.length;

        this.#syncTextCellsToBlocks();
        this.#blocks.splice(insertAt, 0, block);

        const container = this._element.querySelector('.cell-list__cells');
        const emptyState = this._element.querySelector('.cell-list__empty-state');
        container.style.display = '';
        emptyState.style.display = 'none';

        const cell = this.#createCell(container, block, this.#buildCellCallbacks(block));
        cell.mount();
        const cellIdx = insertAt;
        if (cellIdx < this.#cells.length) {
            container.insertBefore(cell._element, this.#cells[cellIdx]._element);
            this.#cells.splice(cellIdx, 0, cell);
        } else {
            this.#cells.push(cell);
        }
        if (this.#onRerender) this.#onRerender();
    }

    #applyBlockDeleted(blockId) {
        const idx = this.#blocks.findIndex((b) => b.id === blockId);
        if (idx < 0) return;
        this.#blocks.splice(idx, 1);

        const cellIdx = this.#cells.findIndex((c) => c.getBlockId() === blockId);
        if (cellIdx >= 0) {
            this.#cells[cellIdx].unmount();
            this.#cells.splice(cellIdx, 1);
        }

        if (this.#blocks.length === 0) {
            const container = this._element.querySelector('.cell-list__cells');
            const emptyState = this._element.querySelector('.cell-list__empty-state');
            container.style.display = 'none';
            emptyState.style.display = '';
        }
        if (this.#onRerender) this.#onRerender();
    }

    addBlock(blockData) {
        this.#blocks.push(blockData);
        this.updateBlocks(this.#blocks);
    }

    #syncTextCellsToBlocks() {
        for (const cell of this.#cells) {
            if (cell instanceof TextCell) {
                const block = this.#blocks.find((b) => b.id === cell.getBlockId());
                if (block) block.content = cell.getContent();
            }
        }
    }

    #moveBlock(id, direction) {
        const index = this.#blocks.findIndex((b) => b.id === id);
        if (index < 0) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.#blocks.length) return;

        this.#syncTextCellsToBlocks();

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

    /**
     * Содержит ли список фокус ввода (textarea/contentEditable любой ячейки).
     * Нужно, чтобы remote-resync не переписывал ячейку, в которой пользователь сейчас печатает.
     * @returns {boolean}
     */
    containsActiveElement() {
        const active = document.activeElement;
        if (!active) return false;
        return this.#cells.some((c) => c._element && c._element.contains(active));
    }
}
