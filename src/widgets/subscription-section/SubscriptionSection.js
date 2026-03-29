import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';

/**
 * SubscriptionSection displays the user's current plan and a coming-soon notice.
 * @extends BaseComponent
 */
export class SubscriptionSection extends BaseComponent {
    /**
     * @param {HTMLElement} parent - container element
     */
    constructor(parent) {
        super(null, parent);
        this.#render();
    }

    /**
     * Renders the section from the Handlebars template.
     */
    #render() {
        const template = Handlebars.templates['SubscriptionSection'];
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = template();
        this._element = tempContainer.firstElementChild;
    }
}
