import { BaseComponent } from '../base-component/BaseComponent.js';
import { TextCellTemplate } from './TextCell.template.js';
import type { BlockData } from '../../types.js';

export interface TextCellOptions {
    blockData: BlockData;
    onMoveUp?: (id: string) => void;
    onMoveDown?: (id: string) => void;
    onCopy?: (id: string) => void;
    onDelete?: (id: string) => void;
    onContentChange?: (id: string, content: string) => void;
}

export class TextCell extends BaseComponent {
    #blockData: BlockData;
    #onMoveUp?: (id: string) => void;
    #onMoveDown?: (id: string) => void;
    #onCopy?: (id: string) => void;
    #onDelete?: (id: string) => void;
    #onContentChange?: (id: string, content: string) => void;

    constructor(
        parent: HTMLElement,
        { blockData, onMoveUp, onMoveDown, onCopy, onDelete, onContentChange }: TextCellOptions
    ) {
        super(null, parent);
        this.#blockData = blockData;
        this.#onMoveUp = onMoveUp;
        this.#onMoveDown = onMoveDown;
        this.#onCopy = onCopy;
        this.#onDelete = onDelete;
        this.#onContentChange = onContentChange;
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = TextCellTemplate({
            id: this.#blockData.id,
            content: this.#blockData.content || ''
        });
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    #attachEvents(): void {
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

        const contentEl = this._element.querySelector('.text-cell__content')!;
        this._addListener(contentEl, 'blur', () => {
            if (this.#onContentChange) {
                this.#onContentChange(this.#blockData.id, contentEl.textContent!);
            }
        });
    }

    getContent(): string {
        return this._element.querySelector('.text-cell__content')!.textContent!;
    }

    setContent(text: string): void {
        this._element.querySelector('.text-cell__content')!.textContent = text;
    }

    highlightMatch(_matchIndex: number, start: number, end: number): void {
        const el = this._element.querySelector('.text-cell__content')!;
        const raw = el.textContent!;
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

    clearHighlights(): void {
        const el = this._element.querySelector('.text-cell__content')!;
        el.querySelectorAll('mark.find-match').forEach((m) => {
            m.replaceWith(document.createTextNode(m.textContent!));
        });
        el.normalize();
    }

    getBlockId(): string {
        return this.#blockData.id;
    }
}
