import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';

export class NotebookToolbar extends BaseComponent {
    #onAddCode;
    #onAddText;
    #onRunAll;

    constructor(parent, { onAddCode, onAddText, onRunAll }) {
        super(null, parent);
        this.#onAddCode = onAddCode;
        this.#onAddText = onAddText;
        this.#onRunAll = onRunAll;
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['NotebookToolbar'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template({});
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    unmount() {
        if (!this._isMounted) return;
        super.unmount();
    }

    #attachEvents() {
        this._element.querySelectorAll('.notebook-toolbar__btn').forEach((btn) => {
            const action = btn.dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'add-code' && this.#onAddCode) this.#onAddCode();
                if (action === 'add-text' && this.#onAddText) this.#onAddText();
                if (action === 'run-all' && this.#onRunAll) this.#onRunAll();
            });
        });
    }
}
