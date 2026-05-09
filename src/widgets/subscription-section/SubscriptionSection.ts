import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { SubscriptionSectionTemplate } from './SubscriptionSection.template.js';

/**
 * Секция подписки в профиле. Сейчас статичная (показывает текущий план и
 * заглушку "скоро будет выбор тарифов"), без интерактивности.
 */
export class SubscriptionSection extends BaseComponent {
    /**
     * Создаёт и сразу рендерит секцию.
     * @param parent - родительский элемент для монтирования
     */
    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = SubscriptionSectionTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }
}
