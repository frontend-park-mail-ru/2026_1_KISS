/* eslint-disable max-classes-per-file -- TODO(refactor): split inner helper class out of CellList.ts; pre-existing tech debt */
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { CellListTemplate } from './CellList.template.js';
import { CodeCell, type CodeCellOptions } from '../../shared/components/code-cell/CodeCell.js';
import { TextCell, type TextCellOptions } from '../../shared/components/text-cell/TextCell.js';
import { CommentThread } from '../../shared/components/comment-thread/CommentThread.js';
import { NotebookApi } from '../../shared/api/NotebookApi.js';
import type { Comment } from '../../shared/types.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Опциональные callback'и CellList — все вызываются родителем (BlocksPage)
 * чтобы синхронизировать состояние с сервером.
 */
interface CellListCallbacks {
    /** Запустить блок (для CodeCell.Run) */
    onRunCell?: (id: string) => void;
    /** Сообщить что список перерисован (например для пересчёта outline) */
    onRerender?: () => void;
    /** Удалить блок */
    onDeleteCell?: (id: string) => void;
    /** Сохранить содержимое (для TextCell.blur и аналогов) */
    onSaveContent?: (id: string, content: string) => void;
    /** Изменено содержимое code-cell (debounced) */
    onCodeContentChange?: (id: string, content: string) => void;
    /** Изменён порядок блоков (move up/down) */
    onReorder?: (ids: string[]) => void;
}

/**
 * Локальное представление блока в CellList. Расширяется при applyRemoteEvent
 * (приходящие WS-события могут добавлять position).
 */
interface BlockData {
    /** ID блока */
    id: string;
    /** Тип: 'code' / 'text' */
    type: string;
    /** Содержимое */
    content?: string;
    /** Позиция в notebook'е */
    position?: number;
}

/**
 * Полные опции конструктора CellList: callback'и + контекст notebook'а.
 */
interface CellListOptions extends CellListCallbacks {
    /** ID notebook'а — пробрасывается в CommentThread */
    notebookId: number | string;
    /** ID текущего пользователя — для определения "своих" комментариев */
    currentUserId: number;
    /** true если текущий пользователь — владелец */
    isOwner: boolean;
    /** Имеет ли пользователь право комментировать */
    canComment: boolean;
}

/**
 * Внутренний holder для одной строки CellList: связывает Cell (Code/Text),
 * CommentThread и DOM-row. Инкапсулирует размонтирование (cleanup всех трёх
 * частей одной строки за один unmount).
 */
class CellRow {
    #cell: CodeCell | TextCell;
    #commentThread: CommentThread;
    #rowElement: HTMLElement;

    /**
     * Сохраняет ссылки на DOM-row и компоненты cell + commentThread.
     * @param rowElement - DOM-элемент строки
     * @param cell - Code- или Text-cell компонент
     * @param commentThread - связанная ветка комментариев
     */
    public constructor(
        rowElement: HTMLElement,
        cell: CodeCell | TextCell,
        commentThread: CommentThread
    ) {
        this.#rowElement = rowElement;
        this.#cell = cell;
        this.#commentThread = commentThread;
    }

    /**
     * Возвращает компонент ячейки для прямых операций (highlight/setContent/...).
     * @returns Code- или Text-cell
     */
    public getCell(): CodeCell | TextCell {
        return this.#cell;
    }

    /**
     * Возвращает ветку комментариев строки.
     * @returns CommentThread
     */
    public getCommentThread(): CommentThread {
        return this.#commentThread;
    }

    /**
     * Возвращает DOM-элемент строки (для перестановки/измерений/проверок focus).
     * @returns HTMLElement строки
     */
    public getRowElement(): HTMLElement {
        return this.#rowElement;
    }

    /**
     * Размонтирует все три части (commentThread → cell → row из DOM).
     */
    public unmount(): void {
        this.#commentThread.unmount();
        this.#cell.unmount();
        this.#rowElement.remove();
    }
}

/**
 * Список ячеек notebook'а — основной композитный виджет страницы блоков.
 * Управляет коллекцией строк (Cell + CommentThread), синхронизирует их с
 * массивом #blocks, обрабатывает локальные действия (move/copy/delete/run)
 * через callback'и родителю и применяет real-time события от WS через
 * applyRemoteEvent (block_added/updated/deleted, comment_added/deleted).
 *
 * Особенности:
 * - При фокусе внутри ячейки игнорирует block_updated от WS — иначе пользователь
 *   потеряет правки во время чужого изменения. Это допустимая UX-цена за избегание
 *   полноценной CRDT-синхронизации.
 * - При move/copy текстовых ячеек сначала вызывает #syncTextCellsToBlocks —
 *   TextCell хранит актуальное содержимое в DOM (contenteditable), а не в #blocks.
 */
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

    /**
     * Создаёт CellList с callback'ами и контекстом notebook'а.
     * @param parent - родительский элемент
     * @param options - callback'и + notebookId/currentUserId/isOwner/canComment
     */
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

    /**
     * Рендерит каркас списка из шаблона.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = CellListTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит каркас. Реальные строки появляются при первом updateBlocks.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
    }

    /**
     * Размонтирует все строки (cell + comment thread каждой) и сам каркас.
     */
    public unmount(): void {
        this.#clearCells();
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Полностью пересоздаёт строки из переданного массива блоков. Используется
     * при первоначальной загрузке notebook'а и после move/reorder. Управляет
     * видимостью empty-state vs контейнера ячеек. После рендера зовёт onRerender.
     * @param blocks - новый массив блоков (заменяет текущий)
     */
    public updateBlocks(blocks: BlockData[]): void {
        this.#clearCells();
        this.#blocks = [...blocks];

        const container = nn(this._element.querySelector<HTMLElement>('.cell-list__cells'));
        const emptyState = nn(this._element.querySelector<HTMLElement>('.cell-list__empty-state'));

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

    /**
     * Создаёт DOM-row + cell-wrapper + comment-wrapper + CodeCell/TextCell
     * + CommentThread. Возвращает обёртку CellRow для последующей работы.
     * Сама row уже добавлена в container; cell и thread ещё НЕ смонтированы
     * (вызывающий должен сделать это).
     * @param container - DOM-контейнер для строк
     * @param block - данные блока
     * @returns обёртка CellRow
     */
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
            api: nn(this.#api)
        });

        return new CellRow(rowElement, cell, commentThread);
    }

    /**
     * Создаёт CodeCell или TextCell по типу блока с правильными callback'ами.
     * Для CodeCell добавляет onRun (запуск) и onContentChange (debounced save).
     * Для TextCell — onContentChange как onSaveContent (без debounce — blur).
     * @param container - DOM-контейнер для самой ячейки
     * @param block - данные блока
     * @returns Code- или Text-cell
     */
    #createCell(container: HTMLElement, block: BlockData): CodeCell | TextCell {
        const callbacks = this.#buildCellCallbacks(block);
        const isReadonly = !this.#isOwner && !this.#canComment;
        if (block.type === 'code') {
            return new CodeCell(container, {
                ...callbacks,
                readonly: isReadonly,
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
            readonly: isReadonly,
            onContentChange: (id: string, content: string) => {
                if (this.#onSaveContent) this.#onSaveContent(id, content);
            }
        } as TextCellOptions);
    }

    /**
     * Собирает общие для Code- и Text-cell callback'и (move/copy/delete) +
     * blockData. Возвращается как Record<string, unknown> чтобы потом spread'ить
     * в специфичные опции каждого типа cell.
     * @param block - данные блока для blockData
     * @returns объект общих callback'ов
     */
    #buildCellCallbacks(block: BlockData): Record<string, unknown> {
        return {
            blockData: block,
            onMoveUp: (id: string): void => {
                this.#moveBlock(id, -1);
            },
            onMoveDown: (id: string): void => {
                this.#moveBlock(id, 1);
            },
            onCopy: (id: string): void => {
                this.#copyBlock(id);
            },
            onDelete: (id: string): void => {
                if (this.#onDeleteCell) this.#onDeleteCell(id);
            }
        };
    }

    /**
     * Применяет real-time событие от WebSocket (block_added/updated/deleted,
     * comment_added/deleted). Игнорирует null/undefined event и неизвестные типы.
     * @param event - WS-событие или null (тогда noop)
     */
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
                this.#applyBlockDeleted(nn(event.block_id));
                break;
            case 'comment_added':
                if (event.comment) {
                    const row = this.#cells.find(
                        (r) => r.getCell().getBlockId() === String(nn(event.comment).block_id)
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
            default:
                break;
        }
    }

    /**
     * Обновляет содержимое блока. Если фокус сейчас внутри этой ячейки — игнорирует
     * (не затирает правки пользователя). Если блок не найден локально — fallback'ит
     * на applyBlockAdded (например событие пришло раньше первой загрузки).
     * @param block - обновлённые данные блока
     */
    #applyBlockUpdated(block: BlockData): void {
        const idx = this.#blocks.findIndex((b) => b.id === block.id);
        if (idx < 0) {
            this.#applyBlockAdded(block);
            return;
        }
        this.#blocks[idx] = { ...this.#blocks[idx], ...block };
        const row = this.#cells[idx];

        const cellEl = row.getCell().getElement();
        if (cellEl.contains(document.activeElement)) return;

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

    /**
     * Добавляет блок на правильную позицию (или в конец если position не задан/
     * вне диапазона). Дедупликация по id — повторное событие игнорируется.
     * Перед вставкой синхронизирует текстовые ячейки чтобы не потерять их состояние.
     * @param block - данные нового блока
     */
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

        const container = nn(this._element.querySelector<HTMLElement>('.cell-list__cells'));
        const emptyState = nn(this._element.querySelector<HTMLElement>('.cell-list__empty-state'));
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

    /**
     * Удаляет блок из локального состояния и DOM. Если блок не найден — noop.
     * После удаления показывает empty-state если блоков не осталось.
     * @param blockId - ID удаляемого блока
     */
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
            const container = nn(this._element.querySelector<HTMLElement>('.cell-list__cells'));
            const emptyState = nn(
                this._element.querySelector<HTMLElement>('.cell-list__empty-state')
            );
            container.style.display = 'none';
            emptyState.style.display = '';
        }
        if (this.#onRerender) this.#onRerender();
    }

    /**
     * Локально добавляет блок в конец и пересоздаёт все строки. Используется
     * для оптимистичного добавления через UI (родитель уже знает id с сервера).
     * @param blockData - данные нового блока
     */
    public addBlock(blockData: BlockData): void {
        this.#blocks.push(blockData);
        this.updateBlocks(this.#blocks);
    }

    /**
     * Копирует текущее содержимое всех TextCell обратно в #blocks. Нужно перед
     * любой операцией перестановки (move/add) — TextCell держит актуальное
     * состояние в contenteditable DOM, а не в #blocks (синхронизация идёт по
     * blur через onSaveContent).
     */
    #syncTextCellsToBlocks(): void {
        for (const row of this.#cells) {
            const cell = row.getCell();
            if (cell instanceof TextCell) {
                const block = this.#blocks.find((b) => b.id === cell.getBlockId());
                if (block) block.content = cell.getContent();
            }
        }
    }

    /**
     * Перемещает блок вверх (-1) или вниз (+1). Синхронизирует текстовые ячейки,
     * меняет местами в #blocks, перерисовывает, уведомляет onReorder с новым
     * порядком id для синхронизации на сервере.
     * @param id - ID перемещаемого блока
     * @param direction - +1 (вниз) или -1 (вверх)
     */
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

    /**
     * Копирует содержимое ячейки в системный буфер обмена через
     * navigator.clipboard. Ошибки игнорирует (например при отсутствии разрешений).
     * @param id - ID блока для копирования
     */
    #copyBlock(id: string): void {
        const block = this.#blocks.find((b) => b.id === id);
        if (!block) return;

        const cell = this.#cells.find((r) => r.getCell().getBlockId() === id);
        if (!cell) return;

        const content = cell.getCell().getContent();
        navigator.clipboard.writeText(content).catch(() => {
            /* noop */
        });
    }

    /**
     * Размонтирует все строки и очищает массив #cells. Не трогает #blocks.
     */
    #clearCells(): void {
        this.#cells.forEach((row) => {
            row.unmount();
        });
        this.#cells = [];
    }

    /**
     * Ищет ячейку по ID блока (для прямых операций родителя — например подсветить
     * результат поиска).
     * @param id - ID блока
     * @returns Code- или Text-cell, либо null если не найдена
     */
    public getCellByBlockId(id: string | number): CodeCell | TextCell | null {
        const row = this.#cells.find((r) => r.getCell().getBlockId() === id);
        return row ? row.getCell() : null;
    }

    /**
     * Возвращает все ячейки в порядке отображения. Используется FindEngine
     * для поиска по всему notebook'у.
     * @returns массив всех Code/Text-cell
     */
    public getAllCells(): (CodeCell | TextCell)[] {
        return this.#cells.map((r) => r.getCell());
    }

    /**
     * Возвращает только code-ячейки в порядке отображения. Используется для
     * Run All / Run From Here.
     * @returns массив CodeCell
     */
    public getCodeCellsInOrder(): CodeCell[] {
        return this.#cells
            .map((r) => r.getCell())
            .filter((c): c is CodeCell => c instanceof CodeCell);
    }

    /**
     * Возвращает индекс блока в текущем массиве (полезно для RunnerApi.executeBlock
     * который требует position, а не id).
     * @param id - ID блока
     * @returns индекс блока (-1 если не найден)
     */
    public getBlockPositionById(id: string | number): number {
        return this.#blocks.findIndex((b) => b.id === id);
    }

    /**
     * Проверяет находится ли currently focused element внутри какой-либо
     * ячейки. Используется чтобы не дёргать save в момент когда пользователь
     * печатает (родитель решает делать save или нет).
     * @returns true если фокус внутри одной из ячеек
     */
    public containsActiveElement(): boolean {
        const active = document.activeElement;
        if (!active) return false;
        return this.#cells.some((r) => r.getRowElement().contains(active));
    }

    /**
     * Переключает видимость comment-thread'ов (через CSS-класс на корневом
     * элементе). Используется toolbar'ом для глобального переключения.
     * @param visible - true для показа, false для скрытия
     */
    public toggleComments(visible: boolean): void {
        this._element.classList.toggle('cell-list--hide-comments', !visible);
    }
}
