import type { EventListenerRecord } from '../../types.js';

export class BaseComponent {
    protected _parent: HTMLElement;
    protected _element: HTMLElement;
    protected _listeners: EventListenerRecord[] = [];
    protected _isMounted = false;

    constructor(element: HTMLElement | null, parent: HTMLElement) {
        this._element = element!;
        this._parent = parent;
    }

    getElement(): HTMLElement {
        return this._element;
    }

    mount(): void {
        this._parent.appendChild(this._element);
        this._isMounted = true;
    }

    unmount(): void {
        this._clearListeners();
        if (this._element && this._parent) {
            this._parent.removeChild(this._element);
        }
        this._isMounted = false;
    }

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

    protected _clearListeners(): void {
        this._listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._listeners = [];
    }
}
