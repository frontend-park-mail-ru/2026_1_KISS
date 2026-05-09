import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { RunnerApi } from '../../shared/api/RunnerApi.js';
import { FindEngine } from '../../shared/search/FindEngine.js';
import { NotebookSidebarTemplate } from './NotebookSidebar.template.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Параметры одного запроса find/replace в notebook'е.
 */
interface FindQuery {
    /** Что искать */
    query: string;
    /** На что заменить (для replace/replace-all) */
    replacement: string;
    /** Учитывать регистр */
    caseSensitive: boolean;
}

/**
 * Сериализованный снимок одной ячейки для FindEngine. Возвращается
 * адаптером — sidebar сам не знает про конкретные классы CodeCell/TextCell.
 */
export interface SearchableCellSnapshot {
    /** ID блока */
    id: number | string;
    /** Тип блока (для разной обработки highlight'а) */
    kind: 'code' | 'text';
    /** Текущее содержимое (с учётом несохранённых изменений) */
    content: string;
}

/**
 * Одно найденное совпадение поиска (структура из FindEngine).
 */
export interface SearchMatch {
    /** ID блока, в котором найдено совпадение */
    blockId: number | string;
    /** Тип блока */
    kind: 'code' | 'text';
    /** Порядковый номер совпадения в этом блоке (0-based) */
    index: number;
    /** Начальная позиция в content */
    start: number;
    /** Конечная позиция в content */
    end: number;
}

/**
 * Адаптер, через который sidebar взаимодействует с ячейками блокнота.
 * Создаётся страницей и передаётся в конструктор виджета. Это разрывает
 * прямую связь sidebar → CodeCell/TextCell — виджет работает только с
 * абстракциями, а классозависимое поведение (highlightRange/highlightMatch)
 * прячется в реализации адаптера.
 */
export interface NotebookSearchAdapter {
    /**
     * Возвращает снимок всех ячеек блокнота для FindEngine.
     * @returns массив SearchableCellSnapshot
     */
    getSearchableCells(): SearchableCellSnapshot[];
    /**
     * Снимает подсветку со всех ячеек (вызывается перед фокусом нового совпадения).
     */
    clearAllHighlights(): void;
    /**
     * Подсвечивает конкретное совпадение в нужной ячейке.
     * @param match - параметры найденного совпадения
     */
    focusMatch(match: SearchMatch): void;
    /**
     * Возвращает текущее содержимое ячейки или null если ячейка не найдена.
     * @param blockId - ID искомого блока
     * @returns строка содержимого или null
     */
    getContent(blockId: number | string): string | null;
    /**
     * Устанавливает новое содержимое ячейки. Возвращает true при успехе.
     * @param blockId - ID блока
     * @param content - новое содержимое
     * @returns true если ячейка найдена и обновлена
     */
    setContent(blockId: number | string, content: string): boolean;
}

/**
 * Опциональный контекст для NotebookSidebar.
 */
interface NotebookSidebarCallbacks {
    /** Адаптер для поиска/замены по ячейкам (если не передан — search-панель не работает) */
    searchTarget?: NotebookSearchAdapter;
    /** ID notebook'а — нужен для resources-панели (поллинг RunnerApi) */
    notebookId?: string | number;
}

/**
 * Сайдбар notebook'а с 4 переключаемыми панелями (search/toc/files/resources).
 * Только одна панель активна одновременно.
 *
 * При открытии resources-панели стартует поллинг RunnerApi.getContainerStats
 * каждые 3 секунды; при закрытии — останавливает. Хранит историю последних 20
 * значений RAM/CPU для рендера sparkline-графиков (SVG inline).
 */
export class NotebookSidebar extends BaseComponent {
    #activePanel: string | null = null;
    #searchTarget: NotebookSearchAdapter | null = null;
    #findEngine = new FindEngine();
    #notebookId: string | number | undefined;
    #runnerApi: RunnerApi;
    #containerPollTimer: ReturnType<typeof setInterval> | null = null;
    #ramHistory: number[] = [];
    #cpuHistory: number[] = [];

    /**
     * Создаёт сайдбар. searchTarget опционален — без него search-панель
     * присутствует, но кнопки не работают.
     * @param parent - родительский элемент
     * @param callbacks - адаптер поиска и notebookId для resources-панели
     */
    public constructor(
        parent: HTMLElement,
        { searchTarget, notebookId }: NotebookSidebarCallbacks = {}
    ) {
        super(null, parent);
        this.#searchTarget = searchTarget ?? null;
        this.#notebookId = notebookId;
        this.#runnerApi = new RunnerApi();
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = NotebookSidebarTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит сайдбар и навешивает обработчики.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    /**
     * Снимает с DOM. Перед этим останавливает поллинг (если активен).
     */
    public unmount(): void {
        if (!this._isMounted) return;
        this.#stopContainerPolling();
        super.unmount();
    }

    /**
     * Обновляет счётчик "X / N" в search-панели после изменения матчей в FindEngine.
     * @param currentIdx - индекс текущего совпадения (0-based)
     * @param total - общее количество совпадений
     */
    public setMatchCount(currentIdx: number, total: number): void {
        const el = this._element.querySelector('.notebook-sidebar__match-count');
        if (!el) return;
        el.textContent = total === 0 ? '0 / 0' : `${String(currentIdx + 1)} / ${String(total)}`;
    }

    /**
     * Снимает текущие значения из find/replace input'ов в виде структуры FindQuery.
     * Используется внутри обработчиков и снаружи (родитель может вызвать вручную).
     * @returns текущие параметры поиска
     */
    public getFindQuery(): FindQuery {
        const findInput = this._element.querySelector<HTMLInputElement>(
            '.notebook-sidebar__find-input'
        );
        const replaceInput = this._element.querySelector<HTMLInputElement>(
            '.notebook-sidebar__replace-input'
        );
        const caseToggle = this._element.querySelector<HTMLInputElement>(
            '.notebook-sidebar__case-toggle'
        );
        return {
            query: findInput ? findInput.value : '',
            replacement: replaceInput ? replaceInput.value : '',
            caseSensitive: caseToggle ? caseToggle.checked : false
        };
    }

    /**
     * Навешивает обработчики: переключение панелей по icon-кнопкам, Enter в
     * find-input для next/prev (Shift+Enter — назад), делегированные клики по
     * data-action кнопкам (find/next/prev/replace/replace-all).
     */
    #attachEvents(): void {
        this._element.querySelectorAll('.notebook-sidebar__icon-btn').forEach((btn) => {
            this._addListener(btn, 'click', () => {
                const panel = nn((btn as HTMLElement).dataset.panel);
                if (this.#activePanel === panel) {
                    this.#closePanel();
                } else {
                    this.#openPanel(panel);
                }
            });
        });

        const findInput = this._element.querySelector('.notebook-sidebar__find-input');
        if (findInput) {
            this._addListener(findInput, 'keydown', (e: Event) => {
                const ke = e as KeyboardEvent;
                if (ke.key !== 'Enter') return;
                ke.preventDefault();
                const q = this.getFindQuery();
                this.#runNav(q, ke.shiftKey ? 'prev' : 'next');
            });
        }

        this._element.querySelectorAll('[data-action]').forEach((btn) => {
            const action = (btn as HTMLElement).dataset.action;
            this._addListener(btn, 'click', (e: Event) => {
                e.preventDefault();
                const q = this.getFindQuery();
                if (action === 'find') this.#runFind(q);
                else if (action === 'next') this.#runNav(q, 'next');
                else if (action === 'prev') this.#runNav(q, 'prev');
                else if (action === 'replace') this.#runReplace(q);
                else if (action === 'replace-all') this.#runReplaceAll(q);
            });
        });
    }

    /**
     * Запускает новый поиск через FindEngine: собирает текущие ячейки через
     * адаптер, передаёт в движок, обновляет счётчик и фокусирует первое
     * совпадение.
     * @param q - параметры поиска
     */
    #runFind(q: FindQuery): void {
        if (!this.#searchTarget) return;
        const cells = this.#searchTarget.getSearchableCells();
        const total = this.#findEngine.search(cells, q.query, q.caseSensitive);
        this.setMatchCount(this.#findEngine.index(), total);
        if (total > 0) this.#focusCurrent();
    }

    /**
     * Навигация по результатам (next/prev). Если поиск ещё не запускали —
     * запускает его перед навигацией.
     * @param q - параметры поиска
     * @param direction - 'next' или 'prev'
     */
    #runNav(q: FindQuery, direction: 'next' | 'prev'): void {
        if (!this.#searchTarget) return;
        if (this.#findEngine.total() === 0) {
            this.#runFind(q);
            return;
        }
        const m = direction === 'next' ? this.#findEngine.next() : this.#findEngine.prev();
        if (m) {
            this.setMatchCount(this.#findEngine.index(), this.#findEngine.total());
            this.#focusCurrent();
        }
    }

    /**
     * Заменяет текущее совпадение и переходит к следующему. Если поиск ещё
     * не активен — сначала запускает поиск.
     * @param q - параметры замены (включая replacement)
     */
    #runReplace(q: FindQuery): void {
        if (!this.#searchTarget) return;
        if (this.#findEngine.total() === 0) {
            this.#runFind(q);
            if (this.#findEngine.total() === 0) return;
        }
        const m = this.#findEngine.current();
        if (!m) return;
        const content = this.#searchTarget.getContent(m.blockId);
        if (content === null) return;
        const updated = content.substring(0, m.start) + q.replacement + content.substring(m.end);
        if (!this.#searchTarget.setContent(m.blockId, updated)) return;
        this.#runFind(q);
    }

    /**
     * Заменяет все вхождения query на replacement во всех ячейках одним
     * RegExp.replace (с эскейпом метасимволов и флагом g/gi). Сбрасывает
     * FindEngine — счётчик показывает 0 после операции.
     * @param q - параметры массовой замены
     */
    #runReplaceAll(q: FindQuery): void {
        if (!this.#searchTarget) return;
        if (q.query === '') return;
        const escaped = q.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, q.caseSensitive ? 'g' : 'gi');
        for (const cell of this.#searchTarget.getSearchableCells()) {
            const updated = cell.content.replace(re, q.replacement);
            if (updated !== cell.content) this.#searchTarget.setContent(cell.id, updated);
        }
        this.#findEngine.reset();
        this.setMatchCount(-1, 0);
    }

    /**
     * Фокусирует и подсвечивает текущее совпадение через адаптер.
     */
    #focusCurrent(): void {
        if (!this.#searchTarget) return;
        this.#searchTarget.clearAllHighlights();
        const m = this.#findEngine.current();
        if (!m) return;
        this.#searchTarget.focusMatch({
            blockId: m.blockId,
            kind: m.kind,
            index: m.index,
            start: m.start,
            end: m.end
        });
    }

    /**
     * Открывает указанную панель: подсвечивает icon-кнопку, делает панель видимой,
     * предварительно закрывая текущую активную. Для resources-панели стартует
     * поллинг контейнера.
     * @param panelName - имя панели ('search', 'toc', 'files', 'resources')
     */
    #openPanel(panelName: string): void {
        this.#closePanel();
        this.#activePanel = panelName;
        const btn = this._element.querySelector(`[data-panel="${panelName}"]`);
        if (btn) btn.classList.add('notebook-sidebar__icon-btn--active');
        const panel = this._element.querySelector(`.notebook-sidebar__panel--${panelName}`);
        if (panel) panel.classList.add('notebook-sidebar__panel--visible');

        if (panelName === 'resources') {
            this.#startContainerPolling();
        }
    }

    /**
     * Закрывает текущую активную панель (если есть). Если это была resources —
     * останавливает поллинг.
     */
    #closePanel(): void {
        if (this.#activePanel === null) return;
        if (this.#activePanel === 'resources') this.#stopContainerPolling();
        const btn = this._element.querySelector(`[data-panel="${this.#activePanel}"]`);
        if (btn) btn.classList.remove('notebook-sidebar__icon-btn--active');
        const panel = this._element.querySelector(`.notebook-sidebar__panel--${this.#activePanel}`);
        if (panel) panel.classList.remove('notebook-sidebar__panel--visible');
        this.#activePanel = null;
    }

    /**
     * Запускает периодический поллинг container stats (первый запрос — сразу,
     * потом каждые 3 секунды).
     */
    #startContainerPolling(): void {
        void this.#pollContainer();
        this.#containerPollTimer = setInterval(() => this.#pollContainer(), 3000);
    }

    /**
     * Останавливает поллинг container stats.
     */
    #stopContainerPolling(): void {
        if ((this.#containerPollTimer ?? 0) !== 0) {
            clearInterval(this.#containerPollTimer);
            this.#containerPollTimer = null;
        }
    }

    /**
     * Один тик поллинга: запрашивает RunnerApi.getContainerStats и обновляет
     * 5 значений (RAM/CPU/Cores/Disk/GPU) + прогресс-бар + sparkline'ы.
     * При ошибке — добавляет --inactive класс.
     */
    async #pollContainer(): Promise<void> {
        if (this.#notebookId === undefined) return;
        const panel = this._element.querySelector('.container-stats--sidebar');
        if (!panel) return;

        try {
            const stats = await this.#runnerApi.getContainerStats(this.#notebookId);
            panel.classList.remove('container-stats--inactive');

            const ramEl = nn(panel.querySelector('[data-metric="ram"]'));
            const cpuEl = nn(panel.querySelector('[data-metric="cpu"]'));
            const coresEl = nn(panel.querySelector('[data-metric="cores"]'));
            const diskEl = nn(panel.querySelector('[data-metric="disk"]'));
            const gpuEl = nn(panel.querySelector('[data-metric="gpu"]'));
            const fill = nn(panel.querySelector<HTMLElement>('.container-stats__bar-fill'));

            const usedMB = (stats.memory_usage / (1024 * 1024)).toFixed(0);
            const limitMB = (stats.memory_limit / (1024 * 1024)).toFixed(0);
            ramEl.textContent = `${usedMB} / ${limitMB} MB`;
            cpuEl.textContent = `${stats.cpu_percent.toFixed(1)}%`;
            coresEl.textContent = String(stats.cpu_cores || 1);
            diskEl.textContent = stats.disk_limit_bytes
                ? `${(stats.disk_limit_bytes / (1024 * 1024)).toFixed(0)} MB`
                : '--';
            gpuEl.textContent = stats.gpu_available ? 'доступна' : 'недоступна';

            const pct = Math.min(100, stats.memory_percent);
            fill.style.width = `${String(pct)}%`;
            fill.className = 'container-stats__bar-fill';
            if (pct < 60) fill.classList.add('container-stats__bar-fill--ok');
            else if (pct < 85) fill.classList.add('container-stats__bar-fill--warn');
            else fill.classList.add('container-stats__bar-fill--danger');

            this.#ramHistory.push(stats.memory_percent);
            this.#cpuHistory.push(stats.cpu_percent);
            if (this.#ramHistory.length > 20) this.#ramHistory.shift();
            if (this.#cpuHistory.length > 20) this.#cpuHistory.shift();
            this.#renderSparklines(panel as HTMLElement);
        } catch {
            panel.classList.add('container-stats--inactive');
        }
    }

    /**
     * Рендерит sparkline-графики для RAM (зелёный) и CPU (оранжевый) в их
     * соответствующие data-sparkline контейнеры.
     * @param panel - корневой элемент resources-панели
     */
    #renderSparklines(panel: HTMLElement): void {
        const ramContainer = panel.querySelector('[data-sparkline="ram"]');
        const cpuContainer = panel.querySelector('[data-sparkline="cpu"]');
        if (ramContainer)
            ramContainer.innerHTML = this.#sparklineSvg(this.#ramHistory, 100, 'var(--teal-green)');
        if (cpuContainer)
            cpuContainer.innerHTML = this.#sparklineSvg(this.#cpuHistory, 100, '#ff9800');
    }

    /**
     * Генерирует SVG-разметку sparkline-графика: тонкая линия + полупрозрачная
     * заливка под линией. Возвращает пустую строку если данных меньше 2.
     * @param data - массив значений (обычно 0-100)
     * @param maxVal - максимум для нормализации (обычно 100)
     * @param color - CSS-цвет линии и заливки
     * @returns строка SVG или пустая строка
     */
    #sparklineSvg(data: number[], maxVal: number, color: string): string {
        if (data.length < 2) return '';
        const w = 218;
        const h = 30;
        const step = w / (data.length - 1);
        const points = data
            .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / maxVal) * h).toFixed(1)}`)
            .join(' ');
        const areaPoints = `0,${String(h)} ${points} ${((data.length - 1) * step).toFixed(1)},${String(h)}`;
        return `<svg viewBox="0 0 ${String(w)} ${String(h)}" class="container-stats__sparkline-svg"><polygon points="${areaPoints}" fill="${color}" opacity="0.15"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
    }
}
