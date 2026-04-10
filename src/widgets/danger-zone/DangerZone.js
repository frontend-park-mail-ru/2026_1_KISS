import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { DangerZoneTemplate } from './DangerZone.template.js';

/**
 * DangerZone displays the account deletion section with a disabled button.
 * @extends BaseComponent
 */
export class DangerZone extends BaseComponent {
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
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = DangerZoneTemplate();
        this._element = tempContainer.firstElementChild;
    }
}
