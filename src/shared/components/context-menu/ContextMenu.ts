import { BaseComponent } from '../base-component/BaseComponent.js';

interface ContextMenuAction {
    label: string;
    handler: () => void;
    danger?: boolean;
}

export class ContextMenu extends BaseComponent {
    #isVisible = false;

    public constructor() {
        const el = document.createElement('div');
        el.className = 'context-menu';
        super(el, document.body);
        this.mount();

        this._addListener(document, 'click', () => {
            if (this.#isVisible) this.hide();
        });
        this._addListener(document, 'keydown', (e: unknown) => {
            if ((e as KeyboardEvent).key === 'Escape' && this.#isVisible) this.hide();
        });
    }

    public show(x: number, y: number, actions: ContextMenuAction[]): void {
        this._element.innerHTML = '';
        actions.forEach(({ label, handler, danger }) => {
            const item = document.createElement('button');
            item.className = 'context-menu__item';
            if (Boolean(danger)) item.classList.add('context-menu__item--danger');
            item.textContent = label;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
                handler();
            });
            this._element.appendChild(item);
        });

        this._element.style.left = `${String(x)}px`;
        this._element.style.top = `${String(y)}px`;
        this._element.classList.add('context-menu--visible');
        this.#isVisible = true;

        requestAnimationFrame(() => {
            const rect = this._element.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this._element.style.left = `${String(x - rect.width)}px`;
            }
            if (rect.bottom > window.innerHeight) {
                this._element.style.top = `${String(y - rect.height)}px`;
            }
        });
    }

    public hide(): void {
        this._element.classList.remove('context-menu--visible');
        this.#isVisible = false;
    }
}
