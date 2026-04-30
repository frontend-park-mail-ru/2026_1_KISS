import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { CellListTemplate } from './CellList.template.js';
import { CodeCell, type CodeCellOptions } from '../../shared/components/code-cell/CodeCell.js';
import { TextCell, type TextCellOptions } from '../../shared/components/text-cell/TextCell.js';

interface CellListCallbacks {
    onRunCell?: (id: string) => void;
    onRerender?: () => void;
    onDeleteCell?: (id: string) => void;
    onSaveContent?: (id: string, content: string) => void;
    onCodeContentChange?: (id: string, content: string) => void;
    onReorder?: (ids: string[]) => void;
}

interface BlockData {
    id: string;
    type: string;
    content?: string;
    position?: number;
}

export class CellList extends BaseComponent {
    #cells: (CodeCell | TextCell)[] = [];
    #blocks: BlockData[] = [];
    #onRunCell: CellListCallbacks['onRunCell'];
    #onRerender: CellListCallbacks['onRerender'];
    #onDeleteCell: CellListCallbacks['onDeleteCell'];
    #onSaveContent: CellListCallbacks['onSaveContent'];
    #onCodeContentChange: CellListCallbacks['onCodeContentChange'];
    #onReorder: CellListCallbacks['onReorder'];

    constructor(
        parent: HTMLElement,
        {
            onRunCell,
            onRerender,
            onDeleteCell,
            onSaveContent,
            onCodeContentChange,
            onReorder
        }: CellListCallbacks = {}
    ) {
        super(null, parent);
        this.#onRunCell = onRunCell;
        this.#onRerender = onRerender;
        this.#onDeleteCell = onDeleteCell;
        this.#onSaveContent = onSaveContent;
        this.#onCodeContentChange = onCodeContentChange;
        this.#onReorder = onReorder;
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = CellListTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    mount(): void {
        if (this._isMounted) return;
        super.mount();
    }

    unmount(): void {
        this.#clearCells();
        if (!this._isMounted) return;
        super.unmount();
    }

    updateBlocks(blocks: BlockData[]): void {
        this.#clearCells();
        this.#blocks = [...blocks];

        const container = this._element.querySelector('.cell-list__cells') as HTMLElement;
        const emptyState = this._element.querySelector('.cell-list__empty-state') as HTMLElement;

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

    #createCell(
        container: HTMLElement,
        block: BlockData,
        cellCallbacks: Record<string, unknown>
    ): CodeCell | TextCell {
        if (block.type === 'code') {
            return new CodeCell(container, {
                ...cellCallbacks,
                onRun: (id: string) => {
                    if (this.#onRunCell) this.#onRunCell(id);
                },
                onContentChange: (id: string, content: string) => {
                    if (this.#onCodeContentChange) this.#onCodeContentChange(id, content);
                }
            } as CodeCellOptions);
        }
        return new TextCell(container, {
            ...cellCallbacks,
            onContentChange: (id: string, content: string) => {
                if (this.#onSaveContent) this.#onSaveContent(id, content);
            }
        } as TextCellOptions);
    }

    #buildCellCallbacks(block: BlockData): Record<string, unknown> {
        return {
            blockData: block,
            onMoveUp: (id: string) => this.#moveBlock(id, -1),
            onMoveDown: (id: string) => this.#moveBlock(id, 1),
            onCopy: (id: string) => this.#copyBlock(id),
            onDelete: (id: string) => {
                if (this.#onDeleteCell) this.#onDeleteCell(id);
            }
        };
    }

    applyRemoteEvent(
        event: { type: string; block?: BlockData; block_id?: string | number } | null
    ): void {
        if (!event) return;
        if (event.type === 'block_updated' && event.block) {
            this.#applyBlockUpdated(event.block);
        } else if (event.type === 'block_added' && event.block) {
            this.#applyBlockAdded(event.block);
        } else if (
            event.type === 'block_deleted' &&
            event.block_id !== undefined &&
            event.block_id !== null
        ) {
            this.#applyBlockDeleted(event.block_id);
        }
    }

    #applyBlockUpdated(block: BlockData): void {
        const idx = this.#blocks.findIndex((b) => b.id === block.id);
        if (idx < 0) {
            this.#applyBlockAdded(block);
            return;
        }
        this.#blocks[idx] = { ...this.#blocks[idx], ...block };
        const cell = this.getCellByBlockId(block.id);
        if (!cell) return;

        const root = cell.getElement();
        if (root && root.contains(document.activeElement)) return;

        if (
            typeof (cell as unknown as { setContent: (c: string) => void }).setContent ===
            'function'
        ) {
            (cell as unknown as { setContent: (c: string) => void }).setContent(
                block.content || ''
            );
        }
    }

    #applyBlockAdded(block: BlockData): void {
        if (this.#blocks.some((b) => b.id === block.id)) return;
        const insertAt =
            typeof block.position === 'number' &&
            block.position >= 0 &&
            block.position < this.#blocks.length
                ? block.position
                : this.#blocks.length;

        this.#syncTextCellsToBlocks();
        this.#blocks.splice(insertAt, 0, block);

        const container = this._element.querySelector('.cell-list__cells') as HTMLElement;
        const emptyState = this._element.querySelector('.cell-list__empty-state') as HTMLElement;
        container.style.display = '';
        emptyState.style.display = 'none';

        const cell = this.#createCell(container, block, this.#buildCellCallbacks(block));
        cell.mount();
        const cellIdx = insertAt;
        if (cellIdx < this.#cells.length) {
            container.insertBefore(cell.getElement(), this.#cells[cellIdx].getElement());
            this.#cells.splice(cellIdx, 0, cell);
        } else {
            this.#cells.push(cell);
        }
        if (this.#onRerender) this.#onRerender();
    }

    #applyBlockDeleted(blockId: string | number): void {
        const idx = this.#blocks.findIndex((b) => b.id === blockId);
        if (idx < 0) return;
        this.#blocks.splice(idx, 1);

        const cellIdx = this.#cells.findIndex((c) => c.getBlockId() === blockId);
        if (cellIdx >= 0) {
            this.#cells[cellIdx].unmount();
            this.#cells.splice(cellIdx, 1);
        }

        if (this.#blocks.length === 0) {
            const container = this._element.querySelector('.cell-list__cells') as HTMLElement;
            const emptyState = this._element.querySelector(
                '.cell-list__empty-state'
            ) as HTMLElement;
            container.style.display = 'none';
            emptyState.style.display = '';
        }
        if (this.#onRerender) this.#onRerender();
    }

    addBlock(blockData: BlockData): void {
        this.#blocks.push(blockData);
        this.updateBlocks(this.#blocks);
    }

    #syncTextCellsToBlocks(): void {
        for (const cell of this.#cells) {
            if (cell instanceof TextCell) {
                const block = this.#blocks.find((b) => b.id === cell.getBlockId());
                if (block) block.content = cell.getContent();
            }
        }
    }

    #moveBlock(id: string, direction: number): void {
        const index = this.#blocks.findIndex((b) => b.id === id);
        if (index < 0) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.#blocks.length) return;

        this.#syncTextCellsToBlocks();

        const temp = this.#blocks[index];
        this.#blocks[index] = this.#blocks[newIndex];
        this.#blocks[newIndex] = temp;

        this.updateBlocks(this.#blocks);

        if (this.#onReorder) {
            this.#onReorder(this.#blocks.map((b) => b.id));
        }
    }

    #copyBlock(id: string): void {
        const block = this.#blocks.find((b) => b.id === id);
        if (!block) return;

        const cell = this.#cells.find((c) => c.getBlockId() === id);
        if (!cell) return;

        const content = cell.getContent();
        navigator.clipboard.writeText(content).catch(() => {});
    }

    #clearCells(): void {
        this.#cells.forEach((cell) => cell.unmount());
        this.#cells = [];
    }

    getCellByBlockId(id: string | number): CodeCell | TextCell | null {
        return this.#cells.find((c) => c.getBlockId() === id) || null;
    }

    getAllCells(): (CodeCell | TextCell)[] {
        return [...this.#cells];
    }

    getCodeCellsInOrder(): CodeCell[] {
        return this.#cells.filter((c): c is CodeCell => c instanceof CodeCell);
    }

    getBlockPositionById(id: string | number): number {
        return this.#blocks.findIndex((b) => b.id === id);
    }

    containsActiveElement(): boolean {
        const active = document.activeElement;
        if (!active) return false;
        return this.#cells.some((c) => c.getElement() && c.getElement().contains(active));
    }
}
