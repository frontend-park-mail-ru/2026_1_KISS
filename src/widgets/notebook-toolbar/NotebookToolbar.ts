import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { NotebookToolbarTemplate } from './NotebookToolbar.template.js';

export class NotebookToolbar extends BaseComponent {
    #onAddCode: () => void;
    #onAddText: () => void;
    #onRunAll: () => void;

    constructor(
        parent: HTMLElement,
        {
            onAddCode,
            onAddText,
            onRunAll
        }: {
            onAddCode: () => void;
            onAddText: () => void;
            onRunAll: () => void;
        }
    ) {
        super(null, parent);
        this.#onAddCode = onAddCode;
        this.#onAddText = onAddText;
        this.#onRunAll = onRunAll;
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = NotebookToolbarTemplate();
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

    getStatsSlot(): HTMLElement | null {
        return this._element?.querySelector('.notebook-toolbar__stats-slot') ?? null;
    }

    #attachEvents(): void {
        this._element.querySelectorAll('.notebook-toolbar__btn').forEach((btn) => {
            const action = (btn as HTMLElement).dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'add-code') this.#onAddCode();
                if (action === 'add-text') this.#onAddText();
                if (action === 'run-all') this.#onRunAll();
            });
        });
    }
}
