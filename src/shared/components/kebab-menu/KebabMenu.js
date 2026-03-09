import { BaseComponent } from '../base-component/BaseComponent.js';

export class KebabMenu extends BaseComponent {
    #actions;
    #isOpen = false;

    constructor(parent, actions) {
        super(null, parent);
        this.#actions = actions;
        this.#render();
    }

    #render() {
        const template = Handlebars.templates['KebabMenu'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template({ actions: this.#actions });
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    unmount() {
        if (!this._isMounted) return;
        this.#isOpen = false;
        super.unmount();
    }

    #attachEvents() {
        const trigger = this._element.querySelector('.kebab-menu__trigger');
        this._addListener(trigger, 'click', (e) => {
            e.stopPropagation();
            this.#toggle();
        });

        this._addListener(document, 'click', () => {
            if (this.#isOpen) this.#close();
        });

        const dropdown = this._element.querySelector('.kebab-menu__dropdown');
        this._addListener(dropdown, 'click', (e) => {
            const item = e.target.closest('[data-action]');
            if (!item) return;
            const action = this.#actions.find((a) => a.name === item.dataset.action);
            if (action && action.handler) action.handler();
            this.#close();
        });
    }

    #toggle() {
        this.#isOpen ? this.#close() : this.#open();
    }

    #open() {
        this.#isOpen = true;
        this._element
            .querySelector('.kebab-menu__dropdown')
            .classList.add('kebab-menu__dropdown_visible');
    }

    #close() {
        this.#isOpen = false;
        this._element
            .querySelector('.kebab-menu__dropdown')
            .classList.remove('kebab-menu__dropdown_visible');
    }
}
