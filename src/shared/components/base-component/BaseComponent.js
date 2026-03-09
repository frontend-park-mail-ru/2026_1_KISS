export class BaseComponent {
    _parent;
    _element;
    _listeners = [];
    _isMounted = false;

    constructor(element, parent) {
        this._element = element;
        this._parent = parent;
    }

    mount() {
        this._parent.appendChild(this._element);
        this._isMounted = true;
    }

    unmount() {
        this._clearListeners();
        if (this._element && this._parent) {
            this._parent.removeChild(this._element);
        }
        this._isMounted = false;
    }

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

    _clearListeners() {
        this._listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._listeners = [];
    }
}
