import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { NotebookToolbarTemplate } from './NotebookToolbar.template.js';

/**
 * Панель инструментов notebook'а: чекбокс показа комментариев, кнопки добавления
 * code/text-блоков и Run All. Все действия делегируются родителю через callback'и.
 *
 * Чекбокс комментариев работает в "managed"-режиме: prevent default,
 * вручную меняем checked и зовём onToggleComments — это нужно потому что
 * родитель сам решает, разрешать ли смену (например запрещает для гостей).
 */
export class NotebookToolbar extends BaseComponent {
    #onAddCode: () => void;
    #onAddText: () => void;
    #onRunAll: () => void;
    #onToggleComments: ((visible: boolean) => void) | null = null;
    #commentsVisible: boolean;

    /**
     * Создаёт панель с заданными callback'ами и начальным состоянием чекбокса.
     * @param parent - родительский элемент
     * @param config - 3 обязательных callback'а + опциональный onToggleComments + начальное состояние
     */
    public constructor(
        parent: HTMLElement,
        {
            onAddCode,
            onAddText,
            onRunAll,
            onToggleComments,
            commentsVisible = false
        }: {
            onAddCode: () => void;
            onAddText: () => void;
            onRunAll: () => void;
            onToggleComments?: (visible: boolean) => void;
            commentsVisible?: boolean;
        }
    ) {
        super(null, parent);
        this.#onAddCode = onAddCode;
        this.#onAddText = onAddText;
        this.#onRunAll = onRunAll;
        this.#onToggleComments = onToggleComments ?? null;
        this.#commentsVisible = commentsVisible;
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = NotebookToolbarTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит панель и навешивает все обработчики.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    /**
     * Снимает с DOM.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Навешивает делегированные click-обработчики на action-кнопки и чекбокс
     * показа комментариев.
     */
    #attachEvents(): void {
        this._element.querySelectorAll('.notebook-toolbar__btn').forEach((btn) => {
            const action = (btn as HTMLElement).dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'add-code') this.#onAddCode();
                if (action === 'add-text') this.#onAddText();
                if (action === 'run-all') this.#onRunAll();
            });
        });

        const toggle = this._element.querySelector('.notebook-toolbar__toggle');
        const toggleInput = toggle?.querySelector('input') as HTMLInputElement | null;
        const onToggle = this.#onToggleComments;
        if (toggle && toggleInput) {
            toggleInput.checked = this.#commentsVisible;
            if (onToggle) {
                this._addListener(toggle, 'click', (e: Event) => {
                    e.preventDefault();
                    toggleInput.checked = !toggleInput.checked;
                    onToggle(toggleInput.checked);
                });
            }
        }
    }
}
