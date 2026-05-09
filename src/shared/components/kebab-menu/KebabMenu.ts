import { BaseComponent } from '../base-component/BaseComponent.js';
import { KebabMenuTemplate } from './KebabMenu.template.js';
import type { KebabAction } from '../../types.js';
import { nn } from '../../utils/notNull.js';

/**
 * Кебаб-меню (вертикальное многоточие) с раскрывающимся списком действий.
 * Используется в строках таблиц (FilesTable) и других местах где не хватает
 * места для всех action-кнопок. Закрывается по клику вне меню.
 */
export class KebabMenu extends BaseComponent {
    #actions: KebabAction[];
    #isOpen = false;

    /**
     * Создаёт меню с заданным набором действий.
     * @param parent - родительский элемент (обычно ячейка таблицы)
     * @param actions - список действий: name, label, handler
     */
    public constructor(parent: HTMLElement, actions: KebabAction[]) {
        super(null, parent);
        this.#actions = actions;
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = KebabMenuTemplate({ actions: this.#actions });
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит меню в DOM и навешивает обработчики trigger/dropdown/document.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    /**
     * Закрывает меню перед размонтированием и снимает с DOM.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        this.#isOpen = false;
        super.unmount();
    }

    /**
     * Навешивает обработчики: trigger (toggle), document (closeOnOutsideClick),
     * dropdown (делегированный click по data-action).
     */
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
            const item = (e as MouseEvent & { target: HTMLElement }).target.closest<HTMLElement>(
                '[data-action]'
            );
            if (!item) return;
            const action = this.#actions.find((a) => a.name === item.dataset.action);
            if (action?.handler) action.handler();
            this.#close();
        });
    }

    /**
     * Переключает состояние меню — открыто/закрыто.
     */
    #toggle(): void {
        if (this.#isOpen) {
            this.#close();
        } else {
            this.#open();
        }
    }

    /**
     * Открывает dropdown (CSS-класс) и устанавливает флаг.
     */
    #open(): void {
        this.#isOpen = true;
        nn(this._element.querySelector('.kebab-menu__dropdown')).classList.add(
            'kebab-menu__dropdown_visible'
        );
    }

    /**
     * Закрывает dropdown и сбрасывает флаг.
     */
    #close(): void {
        this.#isOpen = false;
        nn(this._element.querySelector('.kebab-menu__dropdown')).classList.remove(
            'kebab-menu__dropdown_visible'
        );
    }
}
