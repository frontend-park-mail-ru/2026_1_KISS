import type { RouteDefinition, RouteMatch, PageConstructor } from '../types.js';

/**
 * SPA-роутер на History API. Поддерживает параметризованные пути (`/notebook/:id`),
 * автоматический fallback на defaultPath при ненайденном пути и корректное
 * пересоздание page-компонентов с вызовом destroy у предыдущего.
 *
 * Singleton — нужен для глобального доступа из любых компонентов через
 * Router.getInstance().navigate(...). Создаётся один раз в bootstrap (src/app/index.ts).
 */
export class Router {
    static #instance: Router | null = null;

    #routes: RouteDefinition[] = [];
    #rootElement: HTMLElement;
    #currentPage: { destroy?: () => void } | null = null;
    #defaultPath!: string;

    /**
     * Создаёт роутер привязанный к корневому элементу DOM. Все рендерящиеся
     * страницы будут детьми этого элемента.
     * @param rootElement - DOM-элемент в котором рендерятся страницы (обычно #root)
     */
    public constructor(rootElement: HTMLElement) {
        this.#rootElement = rootElement;
        Router.#instance = this;
    }

    /**
     * Возвращает singleton-экземпляр роутера. Возвращает null если роутер ещё
     * не создан — компоненты должны делать nn(Router.getInstance()) если уверены.
     * @returns экземпляр Router или null
     */
    public static getInstance(): Router | null {
        return Router.#instance;
    }

    /**
     * Регистрирует маршрут с привязкой к классу страницы. Поддерживает параметры
     * вида ':name' — они будут переданы в конструктор PageClass как Record<string,string>.
     * Например, addRoute('/notebook/:id', BlocksPage) даст params = { id: '42' }.
     * @param pattern - паттерн пути (например '/files', '/notebook/:id')
     * @param PageClass - класс страницы с методами render() и опциональным destroy()
     */
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

    /**
     * Задаёт fallback-путь для случаев когда пользователь зашёл на '/' или
     * на несуществующий путь. Должен быть зарегистрирован через addRoute.
     * @param path - путь для редиректа (например '/files')
     */
    public setDefault(path: string): void {
        this.#defaultPath = path;
    }

    /**
     * Запускает роутер: подписывается на popstate (кнопки браузера back/forward)
     * и обрабатывает текущий URL. Если URL — корень, делает navigate на defaultPath.
     */
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

    /**
     * Программная навигация: добавляет запись в history и обрабатывает маршрут.
     * Используется компонентами для перехода между страницами.
     * @param path - целевой путь
     */
    public navigate(path: string): void {
        history.pushState(null, '', path);
        this.#handleRoute(path);
    }

    /**
     * Обрабатывает путь: находит подходящий маршрут, уничтожает текущую страницу
     * (вызывая destroy), создаёт и рендерит новую. Если ни один маршрут не подошёл —
     * редиректит на defaultPath.
     * @param path - путь (может содержать query-string, query отбрасывается)
     */
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

    /**
     * Перебирает зарегистрированные маршруты и возвращает первый совпавший
     * вместе с извлечёнными параметрами. Параметры именованы по addRoute pattern.
     * @param path - pathname без query
     * @returns объект с PageClass и params, либо null если совпадений нет
     */
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
