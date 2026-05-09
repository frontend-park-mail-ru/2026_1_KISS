import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { CellListTemplate } from './CellList.template.js';
import { CodeCell, type CodeCellOptions } from '../../shared/components/code-cell/CodeCell.js';
import { TextCell, type TextCellOptions } from '../../shared/components/text-cell/TextCell.js';
import { CommentThread } from '../../shared/components/comment-thread/CommentThread.js';
import { NotebookApi } from '../../shared/api/NotebookApi.js';
import type { Comment } from '../../shared/types.js';

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

interface CellListOptions extends CellListCallbacks {
    notebookId: number | string;
    currentUserId: number;
    isOwner: boolean;
    canComment: boolean;
}

class CellRow {
    #cell: CodeCell | TextCell;
    #commentThread: CommentThread;
    #rowElement: HTMLElement;

    public constructor(rowElement: HTMLElement, cell: CodeCell | TextCell, commentThread: CommentThread) {
        this.#rowElement = rowElement;
        this.#cell = cell;
        this.#commentThread = commentThread;
    }

    public getCell(): CodeCell | TextCell {
        return this.#cell;
    }

    public getCommentThread(): CommentThread {
        return this.#commentThread;
    }

    public getRowElement(): HTMLElement {
        return this.#rowElement;
    }

    public unmount(): void {
        this.#commentThread.unmount();
        this.#cell.unmount();
        this.#rowElement.remove();
    }
}

export class CellList extends BaseComponent {
    #cells: CellRow[] = [];
    #blocks: BlockData[] = [];
    #onRunCell: CellListCallbacks['onRunCell'];
    #onRerender: CellListCallbacks['onRerender'];
    #onDeleteCell: CellListCallbacks['onDeleteCell'];
    #onSaveContent: CellListCallbacks['onSaveContent'];
    #onCodeContentChange: CellListCallbacks['onCodeContentChange'];
    #onReorder: CellListCallbacks['onReorder'];

    #notebookId: number | string = '';
    #currentUserId = 0;
    #isOwner = false;
    #canComment = false;
    #api: NotebookApi | null = null;

    public constructor(
        parent: HTMLElement,
        {
            onRunCell,
            onRerender,
            onDeleteCell,
            onSaveContent,
            onCodeContentChange,
            onReorder,
            notebookId,
            currentUserId,
            isOwner,
            canComment
        }: CellListOptions
    ) {
        super(null, parent);
        this.#onRunCell = onRunCell;
        this.#onRerender = onRerender;
        this.#onDeleteCell = onDeleteCell;
        this.#onSaveContent = onSaveContent;
        this.#onCodeContentChange = onCodeContentChange;
        this.#onReorder = onReorder;
        this.#notebookId = notebookId;
        this.#currentUserId = currentUserId;
        this.#isOwner = isOwner;
        this.#canComment = canComment;
        this.#api = new NotebookApi();
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = CellListTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    public mount(): void {
        if (this._isMounted) return;
        super.mount();
    }

    public unmount(): void {
        this.#clearCells();
        if (!this._isMounted) return;
        super.unmount();
    }

    public updateBlocks(blocks: BlockData[]): void {
        this.#clearCells();
        this.#blocks = [...blocks];

        const container = this._element.querySelector('.cell-list__cells')!;
        const emptyState = this._element.querySelector('.cell-list__empty-state')!;

        if (blocks.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = '';
            if (this.#onRerender) this.#onRerender();
            return;
        }

        container.style.display = '';
        emptyState.style.display = 'none';

        blocks.forEach((block) => {
            const row = this.#createRow(container, block);
            row.getCell().mount();
            row.getCommentThread().mount();
            this.#cells.push(row);
        });

        if (this.#onRerender) this.#onRerender();
    }

    #createRow(container: HTMLElement, block: BlockData): CellRow {
        const rowElement = document.createElement('div');
        rowElement.className = 'cell-row';
        rowElement.dataset.blockId = block.id;
        container.appendChild(rowElement);

        // Cell wrapper
        const cellWrapper = document.createElement('div');
        cellWrapper.className = 'cell-row__cell';
        rowElement.appendChild(cellWrapper);

        // Comments wrapper
        const commentWrapper = document.createElement('div');
        commentWrapper.className = 'cell-row__comments';
        rowElement.appendChild(commentWrapper);

        // Create cell
        const cell = this.#createCell(cellWrapper, block);

        // Create comment thread
        const commentThread = new CommentThread(commentWrapper, {
            notebookId: this.#notebookId,
            blockId: block.id,
            currentUserId: this.#currentUserId,
            isOwner: this.#isOwner,
            canComment: this.#canComment,
            api: this.#api!
        });

        return new CellRow(rowElement, cell, commentThread);
    }

    #createCell(container: HTMLElement, block: BlockData): CodeCell | TextCell {
        const callbacks = this.#buildCellCallbacks(block);
        if (block.type === 'code') {
            return new CodeCell(container, {
                ...callbacks,
                onRun: (id: string) => {
                    if (this.#onRunCell) this.#onRunCell(id);
                },
                onContentChange: (id: string, content: string) => {
                    if (this.#onCodeContentChange) this.#onCodeContentChange(id, content);
                }
            } as CodeCellOptions);
        }
        return new TextCell(container, {
            ...callbacks,
            onContentChange: (id: string, content: string) => {
                if (this.#onSaveContent) this.#onSaveContent(id, content);
            }
        } as TextCellOptions);
    }

    #buildCellCallbacks(block: BlockData): Record<string, unknown> {
        return {
            blockData: block,
            onMoveUp: (id: string) => { this.#moveBlock(id, -1); },
            onMoveDown: (id: string) => { this.#moveBlock(id, 1); },
            onCopy: (id: string) => { this.#copyBlock(id); },
            onDelete: (id: string) => {
                if (this.#onDeleteCell) this.#onDeleteCell(id);
            }
        };
    }

    public applyRemoteEvent(
        event: {
            type: string;
            block?: BlockData;
            block_id?: string | number;
            comment?: Comment;
            comment_id?: number | string;
        } | null
    ): void {
        if (!event) return;
        switch (event.type) {
            case 'block_updated':
                if (event.block) this.#applyBlockUpdated(event.block);
                break;
            case 'block_added':
                if (event.block) this.#applyBlockAdded(event.block);
                break;
            case 'block_deleted':
                if (event.block_id !== undefined && event.block_id !== null) {
                    this.#applyBlockDeleted(event.block_id);
                }
                break;
            case 'comment_added':
                if (event.comment) {
                    const row = this.#cells.find(
                        (r) => r.getCell().getBlockId() === String(event.comment!.block_id)
                    );
                    row?.getCommentThread().appendComment(event.comment);
                }
                break;
            case 'comment_deleted':
                if (event.comment_id !== undefined && event.block_id !== undefined) {
                    const row = this.#cells.find(
                        (r) => r.getCell().getBlockId() === String(event.block_id)
                    );
                    row?.getCommentThread().removeComment(Number(event.comment_id));
                }
                break;
        }
    }

    #applyBlockUpdated(block: BlockData): void {
        const idx = this.#blocks.findIndex((b) => b.id === block.id);
        if (idx < 0) {
            this.#applyBlockAdded(block);
            return;
        }
        this.#blocks[idx] = { ...this.#blocks[idx], ...block };
        const row = this.#cells[idx];
        if (!row) return;

        const cellEl = row.getCell().getElement();
        if (cellEl && cellEl.contains(document.activeElement)) return;

        const cell = row.getCell();
        if (
            typeof (cell as unknown as { setContent: (c: string) => void }).setContent ===
            'function'
        ) {
            (cell as unknown as { setContent: (c: string) => void }).setContent(
                block.content ?? ''
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

        const container = this._element.querySelector('.cell-list__cells')!;
        const emptyState = this._element.querySelector('.cell-list__empty-state')!;
        container.style.display = '';
        emptyState.style.display = 'none';

        const row = this.#createRow(container, block);
        row.getCell().mount();
        row.getCommentThread().mount();

        const cellIdx = insertAt;
        if (cellIdx < this.#cells.length) {
            container.insertBefore(row.getRowElement(), this.#cells[cellIdx].getRowElement());
            this.#cells.splice(cellIdx, 0, row);
        } else {
            this.#cells.push(row);
        }
        if (this.#onRerender) this.#onRerender();
    }

    #applyBlockDeleted(blockId: string | number): void {
        const idx = this.#blocks.findIndex((b) => b.id === blockId);
        if (idx < 0) return;
        this.#blocks.splice(idx, 1);

        const rowIdx = this.#cells.findIndex((r) => r.getCell().getBlockId() === blockId);
        if (rowIdx >= 0) {
            this.#cells[rowIdx].unmount();
            this.#cells.splice(rowIdx, 1);
        }

        if (this.#blocks.length === 0) {
            const container = this._element.querySelector('.cell-list__cells')!;
            const emptyState = this._element.querySelector(
                '.cell-list__empty-state'
            )!;
            container.style.display = 'none';
            emptyState.style.display = '';
        }
        if (this.#onRerender) this.#onRerender();
    }

    public addBlock(blockData: BlockData): void {
        this.#blocks.push(blockData);
        this.updateBlocks(this.#blocks);
    }

    #syncTextCellsToBlocks(): void {
        for (const row of this.#cells) {
            const cell = row.getCell();
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

        const cell = this.#cells.find((r) => r.getCell().getBlockId() === id);
        if (!cell) return;

        const content = cell.getCell().getContent();
        navigator.clipboard.writeText(content).catch(() => {});
    }

    #clearCells(): void {
        this.#cells.forEach((row) => { row.unmount(); });
        this.#cells = [];
    }

    public getCellByBlockId(id: string | number): CodeCell | TextCell | null {
        const row = this.#cells.find((r) => r.getCell().getBlockId() === id);
        return row ? row.getCell() : null;
    }

    public getAllCells(): (CodeCell | TextCell)[] {
        return this.#cells.map((r) => r.getCell());
    }

    public getCodeCellsInOrder(): CodeCell[] {
        return this.#cells
            .map((r) => r.getCell())
            .filter((c): c is CodeCell => c instanceof CodeCell);
    }

    public getBlockPositionById(id: string | number): number {
        return this.#blocks.findIndex((b) => b.id === id);
    }

    public containsActiveElement(): boolean {
        const active = document.activeElement;
        if (!active) return false;
        return this.#cells.some((r) => r.getRowElement().contains(active));
    }

    public toggleComments(visible: boolean): void {
        if (!this._element) return;
        this._element.classList.toggle('cell-list--hide-comments', !visible);
    }
}
