import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { NotebookSidebarTemplate } from './NotebookSidebar.template.js';

interface FindQuery {
    query: string;
    replacement: string;
    caseSensitive: boolean;
}

interface NotebookSidebarCallbacks {
    onFind?: (q: FindQuery) => void;
    onNext?: (q: FindQuery) => void;
    onPrev?: (q: FindQuery) => void;
    onReplace?: (q: FindQuery) => void;
    onReplaceAll?: (q: FindQuery) => void;
}

export class NotebookSidebar extends BaseComponent {
    #activePanel: string | null = null;
    #onFind: NotebookSidebarCallbacks['onFind'];
    #onNext: NotebookSidebarCallbacks['onNext'];
    #onPrev: NotebookSidebarCallbacks['onPrev'];
    #onReplace: NotebookSidebarCallbacks['onReplace'];
    #onReplaceAll: NotebookSidebarCallbacks['onReplaceAll'];

    constructor(
        parent: HTMLElement,
        { onFind, onNext, onPrev, onReplace, onReplaceAll }: NotebookSidebarCallbacks = {}
    ) {
        super(null, parent);
        this.#onFind = onFind;
        this.#onNext = onNext;
        this.#onPrev = onPrev;
        this.#onReplace = onReplace;
        this.#onReplaceAll = onReplaceAll;
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = NotebookSidebarTemplate();
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

    setMatchCount(currentIdx: number, total: number): void {
        const el = this._element.querySelector('.notebook-sidebar__match-count');
        if (!el) return;
        el.textContent = total === 0 ? '0 / 0' : `${currentIdx + 1} / ${total}`;
    }

    getFindQuery(): FindQuery {
        const findInput = this._element.querySelector(
            '.notebook-sidebar__find-input'
        ) as HTMLInputElement | null;
        const replaceInput = this._element.querySelector(
            '.notebook-sidebar__replace-input'
        ) as HTMLInputElement | null;
        const caseToggle = this._element.querySelector(
            '.notebook-sidebar__case-toggle'
        ) as HTMLInputElement | null;
        return {
            query: findInput ? findInput.value : '',
            replacement: replaceInput ? replaceInput.value : '',
            caseSensitive: caseToggle ? caseToggle.checked : false
        };
    }

    #attachEvents(): void {
        this._element.querySelectorAll('.notebook-sidebar__icon-btn').forEach((btn) => {
            this._addListener(btn, 'click', () => {
                const panel = (btn as HTMLElement).dataset.panel!;
                if (this.#activePanel === panel) {
                    this.#closePanel();
                } else {
                    this.#openPanel(panel);
                }
            });
        });

        const findInput = this._element.querySelector('.notebook-sidebar__find-input');
        if (findInput) {
            this._addListener(findInput, 'keydown', (e: Event) => {
                const ke = e as KeyboardEvent;
                if (ke.key !== 'Enter') return;
                ke.preventDefault();
                const q = this.getFindQuery();
                if (ke.shiftKey) {
                    if (this.#onPrev) this.#onPrev(q);
                } else if (this.#onNext) {
                    this.#onNext(q);
                }
            });
        }

        this._element.querySelectorAll('[data-action]').forEach((btn) => {
            const action = (btn as HTMLElement).dataset.action;
            this._addListener(btn, 'click', (e: Event) => {
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

    #openPanel(panelName: string): void {
        this.#closePanel();
        this.#activePanel = panelName;
        const btn = this._element.querySelector(`[data-panel="${panelName}"]`);
        if (btn) btn.classList.add('notebook-sidebar__icon-btn--active');
        const panel = this._element.querySelector(`.notebook-sidebar__panel--${panelName}`);
        if (panel) panel.classList.add('notebook-sidebar__panel--visible');
    }

    #closePanel(): void {
        if (!this.#activePanel) return;
        const btn = this._element.querySelector(`[data-panel="${this.#activePanel}"]`);
        if (btn) btn.classList.remove('notebook-sidebar__icon-btn--active');
        const panel = this._element.querySelector(`.notebook-sidebar__panel--${this.#activePanel}`);
        if (panel) panel.classList.remove('notebook-sidebar__panel--visible');
        this.#activePanel = null;
    }
}
