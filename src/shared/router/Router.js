export class Router {
    static #instance = null;

    #routes = [];
    #rootElement;
    #currentPage = null;
    #defaultPath;

    constructor(rootElement) {
        this.#rootElement = rootElement;
        Router.#instance = this;
    }

    static getInstance() {
        return Router.#instance;
    }

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

    setDefault(path) {
        this.#defaultPath = path;
    }

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

    navigate(path) {
        history.pushState(null, '', path);
        this.#handleRoute(path);
    }

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
