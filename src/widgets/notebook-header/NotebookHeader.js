import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { Router } from '../../shared/router/Router.js';

export class NotebookHeader extends BaseComponent {
    #config;
    #onRename;
    #originalText = '';
    #isEditing = false;

    constructor(parent, config = {}) {
        super(null, parent);
        this.#config = config;
        this.#onRename = config.onRename || null;
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['NotebookHeader'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template({
            filename: this.#config.filename || 'Untitled',
            user: this.#config.user || null
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
        const logoLink = this._element.querySelector('.notebook-header__logo-link');
        this._addListener(logoLink, 'click', async (e) => {
            e.preventDefault();
            await this.#finishEditing();
            Router.getInstance().navigate('/files');
        });

        const editBtn = this._element.querySelector('.notebook-header__edit-btn');
        this._addListener(editBtn, 'click', () => {
            this.#startRename();
        });
    }

    async #finishEditing() {
        if (!this.#isEditing) return;

        const filenameSpan = this._element.querySelector('.notebook-header__filename');
        this.#isEditing = false;
        filenameSpan.contentEditable = 'false';
        filenameSpan.classList.remove('notebook-header__filename--editing');

        const newTitle = filenameSpan.textContent.trim();
        if (!newTitle) {
            filenameSpan.textContent = this.#originalText;
        } else if (newTitle !== this.#originalText && this.#onRename) {
            await this.#onRename(newTitle);
        }
    }

    #startRename() {
        const filenameSpan = this._element.querySelector('.notebook-header__filename');
        this.#originalText = filenameSpan.textContent;
        this.#isEditing = true;

        filenameSpan.contentEditable = 'true';
        filenameSpan.classList.add('notebook-header__filename--editing');
        filenameSpan.focus();

        const range = document.createRange();
        range.selectNodeContents(filenameSpan);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const controller = new AbortController();

        filenameSpan.addEventListener(
            'keydown',
            (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    filenameSpan.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    controller.abort();
                    this.#isEditing = false;
                    filenameSpan.contentEditable = 'false';
                    filenameSpan.classList.remove('notebook-header__filename--editing');
                    filenameSpan.textContent = this.#originalText;
                }
            },
            { signal: controller.signal }
        );

        filenameSpan.addEventListener(
            'blur',
            () => {
                controller.abort();
                this.#finishEditing();
            },
            { signal: controller.signal }
        );
    }
}
