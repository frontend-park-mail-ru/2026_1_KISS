import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { NotebookToolbarTemplate } from './NotebookToolbar.template.js';

export class NotebookToolbar extends BaseComponent {
    #onAddCode: () => void;
    #onAddText: () => void;
    #onRunAll: () => void;
    #onToggleComments: ((visible: boolean) => void) | null = null;
    #commentsVisible: boolean;

    constructor(
        parent: HTMLElement,
        {
            onAddCode,
            onAddText,
            onRunAll,
            onToggleComments,
            commentsVisible = false
        }: {
            onAddCode: () => void;
            onAddText: () => void;
            onRunAll: () => void;
            onToggleComments?: (visible: boolean) => void;
            commentsVisible?: boolean;
        }
    ) {
        super(null, parent);
        this.#onAddCode = onAddCode;
        this.#onAddText = onAddText;
        this.#onRunAll = onRunAll;
        this.#onToggleComments = onToggleComments ?? null;
        this.#commentsVisible = commentsVisible;
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

    #attachEvents(): void {
        this._element.querySelectorAll('.notebook-toolbar__btn').forEach((btn) => {
            const action = (btn as HTMLElement).dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'add-code') this.#onAddCode();
                if (action === 'add-text') this.#onAddText();
                if (action === 'run-all') this.#onRunAll();
            });
        });

        const toggle = this._element.querySelector(
            '.notebook-toolbar__toggle'
        );
        const toggleInput = toggle?.querySelector('input') as HTMLInputElement | null;
        const onToggle = this.#onToggleComments;
        if (toggle && toggleInput) {
            toggleInput.checked = this.#commentsVisible;
            if (onToggle) {
                this._addListener(toggle, 'click', (e: Event) => {
                    e.preventDefault();
                    toggleInput.checked = !toggleInput.checked;
                    onToggle(toggleInput.checked);
                });
            }
        }
    }
}
