import { BaseComponent } from '../base-component/BaseComponent.js';
import { KebabMenuTemplate } from './KebabMenu.template.js';
import type { KebabAction } from '../../types.js';

export class KebabMenu extends BaseComponent {
    #actions: KebabAction[];
    #isOpen = false;

    constructor(parent: HTMLElement, actions: KebabAction[]) {
        super(null, parent);
        this.#actions = actions;
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = KebabMenuTemplate({ actions: this.#actions });
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    unmount(): void {
        if (!this._isMounted) return;
        this.#isOpen = false;
        super.unmount();
    }

    #attachEvents(): void {
        const trigger = this._element.querySelector('.kebab-menu__trigger');
        this._addListener(trigger, 'click', (e: unknown) => {
            (e as MouseEvent).stopPropagation();
            this.#toggle();
        });

        this._addListener(document, 'click', () => {
            if (this.#isOpen) this.#close();
        });

        const dropdown = this._element.querySelector('.kebab-menu__dropdown');
        this._addListener(dropdown, 'click', (e: unknown) => {
            const item = (e as MouseEvent & { target: HTMLElement }).target.closest(
                '[data-action]'
            );
            if (!item) return;
            const action = this.#actions.find((a) => a.name === item.dataset.action);
            if (action?.handler) action.handler();
            this.#close();
        });
    }

    #toggle(): void {
        if (this.#isOpen) {
            this.#close();
        } else {
            this.#open();
        }
    }

    #open(): void {
        this.#isOpen = true;
        this._element
            .querySelector('.kebab-menu__dropdown')!
            .classList.add('kebab-menu__dropdown_visible');
    }

    #close(): void {
        this.#isOpen = false;
        this._element
            .querySelector('.kebab-menu__dropdown')!
            .classList.remove('kebab-menu__dropdown_visible');
    }
}
