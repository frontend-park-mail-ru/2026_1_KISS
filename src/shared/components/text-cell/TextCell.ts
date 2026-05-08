import { BaseComponent } from '../base-component/BaseComponent.js';
import { TextCellTemplate } from './TextCell.template.js';
import type { BlockData } from '../../types.js';
import { nn } from '../../utils/notNull.js';

/**
 * Опции конструктора TextCell: данные блока + callback'и на действия пользователя.
 */
export interface TextCellOptions {
    /** Серверные данные блока (id, content) */
    blockData: BlockData;
    /** Если true — ячейка только для чтения: contenteditable=false, action-кнопки скрыты, blur-обработчик не вешается */
    readonly?: boolean;
    /** Вызывается при клике на "Переместить вверх" */
    onMoveUp?: (id: string) => void;
    /** Вызывается при клике на "Переместить вниз" */
    onMoveDown?: (id: string) => void;
    /** Вызывается при клике на "Копировать" */
    onCopy?: (id: string) => void;
    /** Вызывается при клике на "Удалить" */
    onDelete?: (id: string) => void;
    /** Вызывается на blur с обновлённым содержимым */
    onContentChange?: (id: string, content: string) => void;
}

/**
 * Текстовая ячейка notebook'а — contenteditable-блок без подсветки синтаксиса.
 * В отличие от CodeCell, не имеет Run-кнопки и output-секции; уведомляет о
 * изменениях по blur (без debounce). Поддерживает поиск с подсветкой совпадений.
 */
export class TextCell extends BaseComponent {
    #blockData: BlockData;
    #readonly: boolean;
    #onMoveUp?: (id: string) => void;
    #onMoveDown?: (id: string) => void;
    #onCopy?: (id: string) => void;
    #onDelete?: (id: string) => void;
    #onContentChange?: (id: string, content: string) => void;

    /**
     * Создаёт текстовую ячейку с заданными данными и callback'ами.
     * @param parent - родительский элемент
     * @param options - данные блока и обработчики (см. TextCellOptions)
     */
    public constructor(
        parent: HTMLElement,
        {
            blockData,
            readonly,
            onMoveUp,
            onMoveDown,
            onCopy,
            onDelete,
            onContentChange
        }: TextCellOptions
    ) {
        super(null, parent);
        this.#blockData = blockData;
        this.#readonly = readonly ?? false;
        this.#onMoveUp = onMoveUp;
        this.#onMoveDown = onMoveDown;
        this.#onCopy = onCopy;
        this.#onDelete = onDelete;
        this.#onContentChange = onContentChange;
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер; в DOM попадает при mount().
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = TextCellTemplate({
            id: this.#blockData.id,
            content: this.#blockData.content || '',
            readonly: this.#readonly
        });
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит ячейку в DOM и навешивает обработчики action-кнопок и blur'а.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    /**
     * Снимает ячейку с DOM. Все слушатели снимаются автоматически через base.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Навешивает обработчики кнопок move/copy/delete и обработчик blur
     * который уведомляет родителя об изменении содержимого.
     */
    #attachEvents(): void {
        if (this.#readonly) return;

        this._element.querySelectorAll('.text-cell__action-btn').forEach((btn) => {
            const action = (btn as HTMLElement).dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'move-up' && this.#onMoveUp) this.#onMoveUp(this.#blockData.id);
                if (action === 'move-down' && this.#onMoveDown)
                    this.#onMoveDown(this.#blockData.id);
                if (action === 'copy' && this.#onCopy) this.#onCopy(this.#blockData.id);
                if (action === 'delete' && this.#onDelete) this.#onDelete(this.#blockData.id);
            });
        });

        const contentEl = nn(this._element.querySelector('.text-cell__content'));
        this._addListener(contentEl, 'blur', () => {
            if (this.#onContentChange) {
                this.#onContentChange(this.#blockData.id, contentEl.textContent);
            }
        });
    }

    /**
     * Возвращает текущий текст ячейки (textContent contenteditable-элемента).
     * @returns plain-text без HTML-тегов
     */
    public getContent(): string {
        return nn(this._element.querySelector('.text-cell__content')).textContent;
    }

    /**
     * Заменяет текст ячейки. Используется при undo/синхронизации.
     * @param text - новый текст
     */
    public setContent(text: string): void {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this._element.querySelector('.text-cell__content')!.textContent = text;
    }

    /**
     * Подсвечивает совпадение поиска через <mark>, скроллит к ячейке.
     * Параметр matchIndex зарезервирован для будущих расширений (например
     * различной подсветки текущего vs остальных совпадений), сейчас не используется.
     * @param _matchIndex - индекс совпадения (зарезервирован)
     * @param start - начальная позиция совпадения
     * @param end - конечная позиция совпадения
     */
    public highlightMatch(_matchIndex: number, start: number, end: number): void {
        const el = nn(this._element.querySelector('.text-cell__content'));
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

    /**
     * Снимает все <mark>-подсветки поиска и нормализует текстовые узлы.
     */
    public clearHighlights(): void {
        const el = nn(this._element.querySelector('.text-cell__content'));
        el.querySelectorAll('mark.find-match').forEach((m) => {
            m.replaceWith(document.createTextNode(m.textContent));
        });
        el.normalize();
    }

    /**
     * Возвращает идентификатор связанного с ячейкой блока.
     * @returns ID блока
     */
    public getBlockId(): string {
        return this.#blockData.id;
    }
}
