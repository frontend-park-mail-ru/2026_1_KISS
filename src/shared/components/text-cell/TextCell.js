import { BaseComponent } from '../base-component/BaseComponent.js';

export class TextCell extends BaseComponent {
    #blockData;
    #onMoveUp;
    #onMoveDown;
    #onCopy;

    constructor(parent, { blockData, onMoveUp, onMoveDown, onCopy }) {
        super(null, parent);
        this.#blockData = blockData;
        this.#onMoveUp = onMoveUp;
        this.#onMoveDown = onMoveDown;
        this.#onCopy = onCopy;
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['TextCell'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template({
            id: this.#blockData.id,
            content: this.#blockData.content || ''
        });
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
        this._element.querySelectorAll('.text-cell__action-btn').forEach((btn) => {
            const action = btn.dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'move-up' && this.#onMoveUp) this.#onMoveUp(this.#blockData.id);
                if (action === 'move-down' && this.#onMoveDown)
                    this.#onMoveDown(this.#blockData.id);
                if (action === 'copy' && this.#onCopy) this.#onCopy(this.#blockData.id);
            });
        });
    }

    getContent() {
        return this._element.querySelector('.text-cell__content').textContent;
    }

    getBlockId() {
        return this.#blockData.id;
    }
}
