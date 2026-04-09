import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { NotebookSidebarTemplate } from './NotebookSidebar.template.js';

export class NotebookSidebar extends BaseComponent {
    #activePanel = null;
    #onFind;
    #onNext;
    #onPrev;
    #onReplace;
    #onReplaceAll;

    constructor(parent, { onFind, onNext, onPrev, onReplace, onReplaceAll } = {}) {
        super(null, parent);
        this.#onFind = onFind;
        this.#onNext = onNext;
        this.#onPrev = onPrev;
        this.#onReplace = onReplace;
        this.#onReplaceAll = onReplaceAll;
        this.#render();
    }

    #render() {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = NotebookSidebarTemplate({});
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

    setMatchCount(currentIdx, total) {
        const el = this._element.querySelector('.notebook-sidebar__match-count');
        if (!el) return;
        el.textContent = total === 0 ? '0 / 0' : `${currentIdx + 1} / ${total}`;
    }

    getFindQuery() {
        const findInput = this._element.querySelector('.notebook-sidebar__find-input');
        const replaceInput = this._element.querySelector('.notebook-sidebar__replace-input');
        const caseToggle = this._element.querySelector('.notebook-sidebar__case-toggle');
        return {
            query: findInput ? findInput.value : '',
            replacement: replaceInput ? replaceInput.value : '',
            caseSensitive: caseToggle ? caseToggle.checked : false
        };
    }

    #attachEvents() {
        this._element.querySelectorAll('.notebook-sidebar__icon-btn').forEach((btn) => {
            this._addListener(btn, 'click', () => {
                const panel = btn.dataset.panel;
                if (this.#activePanel === panel) {
                    this.#closePanel();
                } else {
                    this.#openPanel(panel);
                }
            });
        });

        const findInput = this._element.querySelector('.notebook-sidebar__find-input');
        if (findInput) {
            this._addListener(findInput, 'keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const q = this.getFindQuery();
                if (e.shiftKey) {
                    if (this.#onPrev) this.#onPrev(q);
                } else if (this.#onNext) {
                    this.#onNext(q);
                }
            });
        }

        this._element.querySelectorAll('[data-action]').forEach((btn) => {
            const action = btn.dataset.action;
            this._addListener(btn, 'click', (e) => {
                e.preventDefault();
                const q = this.getFindQuery();
                if (action === 'find' && this.#onFind) this.#onFind(q);
                else if (action === 'next' && this.#onNext) this.#onNext(q);
                else if (action === 'prev' && this.#onPrev) this.#onPrev(q);
                else if (action === 'replace' && this.#onReplace) this.#onReplace(q);
                else if (action === 'replace-all' && this.#onReplaceAll) this.#onReplaceAll(q);
            });
        });
    }

    #openPanel(panelName) {
        this.#closePanel();
        this.#activePanel = panelName;
        const btn = this._element.querySelector(`[data-panel="${panelName}"]`);
        if (btn) btn.classList.add('notebook-sidebar__icon-btn--active');
        const panel = this._element.querySelector(`.notebook-sidebar__panel--${panelName}`);
        if (panel) panel.classList.add('notebook-sidebar__panel--visible');
    }

    #closePanel() {
        if (!this.#activePanel) return;
        const btn = this._element.querySelector(`[data-panel="${this.#activePanel}"]`);
        if (btn) btn.classList.remove('notebook-sidebar__icon-btn--active');
        const panel = this._element.querySelector(`.notebook-sidebar__panel--${this.#activePanel}`);
        if (panel) panel.classList.remove('notebook-sidebar__panel--visible');
        this.#activePanel = null;
    }
}
