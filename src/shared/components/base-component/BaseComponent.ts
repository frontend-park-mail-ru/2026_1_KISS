import type { EventListenerRecord } from '../../types.js';

/**
 * Базовый класс всех UI-компонентов проекта. Реализует жизненный цикл
 * (mount/unmount), хранит ссылки на корневой DOM-элемент и родителя,
 * автоматически снимает все навешанные через _addListener слушатели
 * при размонтировании — защита от утечек памяти и зомби-обработчиков.
 *
 * Наследники должны вызвать super.mount() и super.unmount() — иначе
 * элемент не будет вставлен в DOM и слушатели не очистятся.
 */
export class BaseComponent {
    protected _parent: HTMLElement;
    protected _element: HTMLElement;
    protected _listeners: EventListenerRecord[] = [];
    protected _isMounted = false;

    /**
     * Инициализирует компонент с привязкой к корневому элементу и родителю.
     * Если element === null — наследник обязан установить this._element до mount.
     * @param element - корневой DOM-элемент компонента (или null если создаётся в наследнике)
     * @param parent - родительский элемент в который компонент будет вмонтирован
     */
    public constructor(element: HTMLElement | null, parent: HTMLElement) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- subclasses set _element in their own #render() before mount; runtime nn() check broke FilterBar/SubscriptionSection/ProfileSection (introduced in a7eb4da)
        this._element = element!;
        this._parent = parent;
    }

    /**
     * Возвращает корневой DOM-элемент компонента. Используется когда компоненту
     * нужно отдать наружу ссылку на свой root (например для портала или измерений).
     * @returns корневой HTMLElement компонента
     */
    public getElement(): HTMLElement {
        return this._element;
    }

    /**
     * Вставляет корневой элемент в родителя и помечает компонент как смонтированный.
     * Идемпотентность контролирует наследник через флаг this._isMounted.
     */
    public mount(): void {
        this._parent.appendChild(this._element);
        this._isMounted = true;
    }

    /**
     * Снимает все слушатели и удаляет элемент из DOM. Должен вызываться
     * перед уничтожением компонента, иначе утекут ссылки.
     */
    public unmount(): void {
        this._clearListeners();
        this._parent.removeChild(this._element);
        this._isMounted = false;
    }

    /**
     * Регистрирует обработчик события и запоминает его для последующей очистки.
     * Альтернатива прямому addEventListener — гарантирует автоматическое удаление
     * слушателя при unmount. Если element === null, ничего не делает.
     * @param element - целевой EventTarget (DOM-элемент, document, window, ...)
     * @param event - имя события ('click', 'input', ...)
     * @param handler - функция-обработчик; будет забинжена на this компонента
     */
    protected _addListener(
        element: EventTarget | null,
        event: string,
        handler: EventListener
    ): void {
        if (!element) return;

        const wrappedHandler = (handler as (...args: unknown[]) => void).bind(
            this
        ) as EventListener;
        element.addEventListener(event, wrappedHandler);

        this._listeners.push({
            element,
            event,
            handler: wrappedHandler
        });
    }

    /**
     * Снимает все ранее зарегистрированные через _addListener слушатели и
     * очищает внутренний реестр. Вызывается из unmount; наследники могут
     * вызывать вручную при reset.
     */
    protected _clearListeners(): void {
        this._listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._listeners = [];
    }
}
