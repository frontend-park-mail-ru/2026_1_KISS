import { BaseComponent } from '../base-component/BaseComponent.js';

export class CodeCell extends BaseComponent {
    #blockData;
    #onMoveUp;
    #onMoveDown;
    #onCopy;
    #onRun;

    constructor(parent, { blockData, onMoveUp, onMoveDown, onCopy, onRun }) {
        super(null, parent);
        this.#blockData = blockData;
        this.#onMoveUp = onMoveUp;
        this.#onMoveDown = onMoveDown;
        this.#onCopy = onCopy;
        this.#onRun = onRun;
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['CodeCell'];
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
        this.#updateLineNumbers();
        this.#autoResize();
        this.#attachEvents();
    }

    unmount() {
        if (!this._isMounted) return;
        super.unmount();
    }

    #attachEvents() {
        const textarea = this._element.querySelector('.code-cell__textarea');

        this._addListener(textarea, 'input', () => {
            this.#updateLineNumbers();
            this.#autoResize();
        });

        this._addListener(textarea, 'keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value =
                    textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
                this.#updateLineNumbers();
            }
        });

        const runBtn = this._element.querySelector('.code-cell__run-btn');
        this._addListener(runBtn, 'click', () => {
            if (this.#onRun) this.#onRun(this.#blockData.id);
        });

        this._element.querySelectorAll('.code-cell__action-btn').forEach((btn) => {
            const action = btn.dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'move-up' && this.#onMoveUp) this.#onMoveUp(this.#blockData.id);
                if (action === 'move-down' && this.#onMoveDown)
                    this.#onMoveDown(this.#blockData.id);
                if (action === 'copy' && this.#onCopy) this.#onCopy(this.#blockData.id);
            });
        });
    }

    #updateLineNumbers() {
        const textarea = this._element.querySelector('.code-cell__textarea');
        const lineNumbers = this._element.querySelector('.code-cell__line-numbers');
        const lines = textarea.value.split('\n');
        lineNumbers.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
    }

    #autoResize() {
        const textarea = this._element.querySelector('.code-cell__textarea');
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    getContent() {
        return this._element.querySelector('.code-cell__textarea').value;
    }

    getBlockId() {
        return this.#blockData.id;
    }
}
