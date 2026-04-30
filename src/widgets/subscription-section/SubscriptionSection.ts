import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { SubscriptionSectionTemplate } from './SubscriptionSection.template.js';

export class SubscriptionSection extends BaseComponent {
    constructor(parent: HTMLElement) {
        super(null, parent);
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = SubscriptionSectionTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }
}
