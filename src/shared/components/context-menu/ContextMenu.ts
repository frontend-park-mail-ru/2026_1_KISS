import { BaseComponent } from '../base-component/BaseComponent.js';

/**
 * Описание одного действия в контекстном меню.
 */
interface ContextMenuAction {
    /** Текст пункта меню */
    label: string;
    /** Вызывается при клике на пункт */
    handler: () => void;
    /** true если пункт деструктивный (показывается красным) */
    danger?: boolean;
}

/**
 * Универсальное контекстное меню — открывается в произвольной точке (x, y),
 * автоматически перепозиционируется чтобы не вылезти за границы окна,
 * закрывается по Escape или клику вне меню.
 *
 * Один экземпляр ContextMenu можно переиспользовать для разных контекстов:
 * каждый show() полностью перерендерит пункты.
 */
export class ContextMenu extends BaseComponent {
    #isVisible = false;

    /**
     * Создаёт скрытое меню в document.body и навешивает глобальные обработчики
     * закрытия (click и Escape).
     */
    public constructor() {
        const el = document.createElement('div');
        el.className = 'context-menu';
        super(el, document.body);
        this.mount();

        this._addListener(document, 'click', () => {
            if (this.#isVisible) this.hide();
        });
        this._addListener(document, 'keydown', (e: unknown) => {
            if ((e as KeyboardEvent).key === 'Escape' && this.#isVisible) this.hide();
        });
    }

    /**
     * Открывает меню в точке (x, y) с заданным набором действий. Если меню
     * выходит за правую/нижнюю границу viewport — сдвигается на свою ширину/высоту.
     * @param x - координата X клика (clientX)
     * @param y - координата Y клика (clientY)
     * @param actions - список пунктов меню
     */
    public show(x: number, y: number, actions: ContextMenuAction[]): void {
        this._element.innerHTML = '';
        actions.forEach(({ label, handler, danger }) => {
            const item = document.createElement('button');
            item.className = 'context-menu__item';
            if (danger === true) item.classList.add('context-menu__item--danger');
            item.textContent = label;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
                handler();
            });
            this._element.appendChild(item);
        });

        this._element.style.left = `${String(x)}px`;
        this._element.style.top = `${String(y)}px`;
        this._element.classList.add('context-menu--visible');
        this.#isVisible = true;

        requestAnimationFrame(() => {
            const rect = this._element.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this._element.style.left = `${String(x - rect.width)}px`;
            }
            if (rect.bottom > window.innerHeight) {
                this._element.style.top = `${String(y - rect.height)}px`;
            }
        });
    }

    /**
     * Скрывает меню (CSS-класс) и сбрасывает флаг видимости. Безопасно вызывать
     * когда меню уже скрыто — лишний noop.
     */
    public hide(): void {
        this._element.classList.remove('context-menu--visible');
        this.#isVisible = false;
    }
}
