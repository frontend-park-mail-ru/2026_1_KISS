/**
 * @module shared/router/Router
 *
 * SPA-роутер на History API. Singleton -- создаётся один раз в точке входа,
 * далее доступен через `Router.getInstance()`.
 */

/** @typedef {import('../types.js').RouteDefinition} RouteDefinition */
/** @typedef {import('../types.js').RouteMatch} RouteMatch */

/**
 * Клиентский роутер с поддержкой параметризованных путей (`:id`).
 * Хранит таблицу маршрутов, при навигации создаёт экземпляр страницы
 * и вызывает `render()`.
 */
export class Router {
    /** @type {?Router} @private @static */
    static #instance = null;

    /** @type {RouteDefinition[]} */
    #routes = [];

    /** @type {HTMLElement} */
    #rootElement;

    /** @type {?Object} */
    #currentPage = null;

    /** @type {string} */
    #defaultPath;

    /**
     * @param {HTMLElement} rootElement -- корневой DOM-элемент для рендера страниц
     */
    constructor(rootElement) {
        this.#rootElement = rootElement;
        Router.#instance = this;
    }

    /**
     * Возвращает единственный экземпляр роутера.
     *
     * @returns {?Router}
     */
    static getInstance() {
        return Router.#instance;
    }

    /**
     * Регистрирует маршрут. Паттерн вида `/notebooks/:id` преобразуется
     * в RegExp с именованными группами.
     *
     * @param {string} pattern -- паттерн маршрута (например '/notebooks/:id')
     * @param {Function} PageClass -- конструктор страницы
     */
    addRoute(pattern, PageClass) {
        const paramNames = [];
        const regexpStr = pattern.replace(/:([^/]+)/g, (_match, name) => {
            paramNames.push(name);
            return '([^/]+)';
        });
        this.#routes.push({
            pattern,
            regexp: new RegExp(`^${regexpStr}$`),
            paramNames,
            PageClass
        });
    }

    /**
     * Устанавливает маршрут по умолчанию (редирект для '/' и неизвестных путей).
     *
     * @param {string} path -- путь по умолчанию
     */
    setDefault(path) {
        this.#defaultPath = path;
    }

    /**
     * Запускает роутер: подписывается на popstate и обрабатывает текущий URL.
     * Корневой путь ('/' или '') редиректит на defaultPath.
     */
    start() {
        window.addEventListener('popstate', () => {
            this.#handleRoute(window.location.pathname);
        });

        const path = window.location.pathname;
        if (path === '/' || path === '') {
            this.navigate(this.#defaultPath);
        } else {
            this.#handleRoute(path);
        }
    }

    /**
     * Программный переход на указанный путь.
     * Добавляет запись в history и рендерит соответствующую страницу.
     *
     * @param {string} path -- например '/files' или '/notebooks/42'
     */
    navigate(path) {
        history.pushState(null, '', path);
        this.#handleRoute(path);
    }

    /**
     * Уничтожает текущую страницу (если есть destroy) и рендерит новую.
     * При отсутствии совпадения -- редирект на defaultPath.
     *
     * @private
     * @param {string} path -- текущий pathname
     */
    #handleRoute(path) {
        const matched = this.#matchRoute(path);
        if (!matched) {
            this.navigate(this.#defaultPath);
            return;
        }

        if (this.#currentPage && this.#currentPage.destroy) {
            this.#currentPage.destroy();
        }

        const page = new matched.PageClass(this.#rootElement, matched.params);
        this.#currentPage = page;
        page.render();
    }

    /**
     * Ищет первый маршрут, совпадающий с путём, и извлекает параметры.
     *
     * @private
     * @param {string} path -- текущий pathname
     * @returns {?RouteMatch} совпавший маршрут с params или null
     */
    #matchRoute(path) {
        for (const route of this.#routes) {
            const match = path.match(route.regexp);
            if (match) {
                const params = {};
                route.paramNames.forEach((name, i) => {
                    params[name] = match[i + 1];
                });
                return { PageClass: route.PageClass, params };
            }
        }
        return null;
    }
}
