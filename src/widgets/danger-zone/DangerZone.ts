import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { DangerZoneTemplate } from './DangerZone.template.js';

export class DangerZone extends BaseComponent {
    constructor(parent: HTMLElement) {
        super(null, parent);
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = DangerZoneTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }
}
