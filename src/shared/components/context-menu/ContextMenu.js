import { BaseComponent } from '../base-component/BaseComponent.js';

export class ContextMenu extends BaseComponent {
    #isVisible = false;

    constructor() {
        const el = document.createElement('div');
        el.className = 'context-menu';
        super(el, document.body);
        this.mount();

        this._addListener(document, 'click', () => {
            if (this.#isVisible) this.hide();
        });
        this._addListener(document, 'contextmenu', () => {
            if (this.#isVisible) this.hide();
        });
        this._addListener(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.#isVisible) this.hide();
        });
    }

    show(x, y, actions) {
        this._element.innerHTML = '';
        actions.forEach(({ label, handler, danger }) => {
            const item = document.createElement('button');
            item.className = 'context-menu__item';
            if (danger) item.classList.add('context-menu__item--danger');
            item.textContent = label;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
                handler();
            });
            this._element.appendChild(item);
        });

        this._element.style.left = `${x}px`;
        this._element.style.top = `${y}px`;
        this._element.classList.add('context-menu--visible');
        this.#isVisible = true;

        requestAnimationFrame(() => {
            const rect = this._element.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this._element.style.left = `${x - rect.width}px`;
            }
            if (rect.bottom > window.innerHeight) {
                this._element.style.top = `${y - rect.height}px`;
            }
        });
    }

    hide() {
        this._element.classList.remove('context-menu--visible');
        this.#isVisible = false;
    }
}
