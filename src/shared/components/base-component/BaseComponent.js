/**
 * @module shared/components/base-component/BaseComponent
 *
 * Базовый класс для всех UI-компонентов.
 * Предоставляет lifecycle (mount/unmount) и автоматическое управление
 * event listeners через _addListener/_clearListeners.
 */

/** @typedef {import('../../types.js').EventListenerRecord} EventListenerRecord */

/**
 * Базовый компонент с lifecycle-управлением DOM и автоочисткой подписок.
 * Наследники создают this._element в конструкторе, затем вызывают mount()
 * для вставки в DOM и unmount() для удаления.
 */
export class BaseComponent {
    /** @type {HTMLElement} @protected */
    _parent;

    /** @type {HTMLElement} @protected */
    _element;

    /** @type {EventListenerRecord[]} @protected */
    _listeners = [];

    /** @type {boolean} @protected */
    _isMounted = false;

    /**
     * @param {?HTMLElement} element -- DOM-элемент компонента (null если создаётся в #render)
     * @param {HTMLElement} parent -- родительский DOM-элемент для mount
     */
    constructor(element, parent) {
        this._element = element;
        this._parent = parent;
    }

    /**
     * Вставляет элемент компонента в родительский DOM-узел.
     */
    mount() {
        this._parent.appendChild(this._element);
        this._isMounted = true;
    }

    /**
     * Снимает все подписки и удаляет элемент из DOM.
     */
    unmount() {
        this._clearListeners();
        if (this._element && this._parent) {
            this._parent.removeChild(this._element);
        }
        this._isMounted = false;
    }

    /**
     * Подписывает элемент на событие и запоминает подписку,
     * чтобы автоматически снять её при unmount.
     * Handler привязывается к this через bind.
     *
     * @protected
     * @param {EventTarget} element -- DOM-элемент для подписки
     * @param {string} event -- название события (click, input и т.д.)
     * @param {Function} handler -- обработчик
     */
    _addListener(element, event, handler) {
        if (!element) return;

        const wrappedHandler = handler.bind(this);
        element.addEventListener(event, wrappedHandler);

        this._listeners.push({
            element,
            event,
            handler: wrappedHandler
        });
    }

    /**
     * Снимает все запомненные подписки и очищает список.
     *
     * @protected
     */
    _clearListeners() {
        this._listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._listeners = [];
    }
}
