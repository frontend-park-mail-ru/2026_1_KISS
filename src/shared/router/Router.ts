import type { RouteDefinition, RouteMatch, PageConstructor } from '../types.js';

export class Router {
    static #instance: Router | null = null;

    #routes: RouteDefinition[] = [];
    #rootElement: HTMLElement;
    #currentPage: { destroy?: () => void } | null = null;
    #defaultPath!: string;

    public constructor(rootElement: HTMLElement) {
        this.#rootElement = rootElement;
        Router.#instance = this;
    }

    public static getInstance(): Router | null {
        return Router.#instance;
    }

    public addRoute(pattern: string, PageClass: PageConstructor): void {
        const paramNames: string[] = [];
        const regexpStr = pattern.replace(/:([^/]+)/g, (_match, name: string) => {
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

    public setDefault(path: string): void {
        this.#defaultPath = path;
    }

    public start(): void {
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

    public navigate(path: string): void {
        history.pushState(null, '', path);
        this.#handleRoute(path);
    }

    #handleRoute(path: string): void {
        const [pathname] = path.split('?');
        const matched = this.#matchRoute(pathname);
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

    #matchRoute(path: string): RouteMatch | null {
        for (const route of this.#routes) {
            const match = path.match(route.regexp);
            if (match) {
                const params: Record<string, string> = {};
                route.paramNames.forEach((name, i) => {
                    params[name] = match[i + 1];
                });
                return { PageClass: route.PageClass, params };
            }
        }
        return null;
    }
}
