import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { RunnerApi } from '../../shared/api/RunnerApi.js';
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
 * Опциональные обработчики и контекст для NotebookSidebar.
 */
interface NotebookSidebarCallbacks {
    /** Старт нового поиска */
    onFind?: (q: FindQuery) => void;
    /** Перейти к следующему совпадению */
    onNext?: (q: FindQuery) => void;
    /** Перейти к предыдущему совпадению */
    onPrev?: (q: FindQuery) => void;
    /** Заменить текущее совпадение */
    onReplace?: (q: FindQuery) => void;
    /** Заменить все совпадения */
    onReplaceAll?: (q: FindQuery) => void;
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
    #onFind: NotebookSidebarCallbacks['onFind'];
    #onNext: NotebookSidebarCallbacks['onNext'];
    #onPrev: NotebookSidebarCallbacks['onPrev'];
    #onReplace: NotebookSidebarCallbacks['onReplace'];
    #onReplaceAll: NotebookSidebarCallbacks['onReplaceAll'];
    #notebookId: string | number | undefined;
    #runnerApi: RunnerApi;
    #containerPollTimer: ReturnType<typeof setInterval> | null = null;
    #ramHistory: number[] = [];
    #cpuHistory: number[] = [];

    /**
     * Создаёт сайдбар. Все callback'и опциональны — их отсутствие просто значит
     * что соответствующие кнопки не будут реагировать.
     * @param parent - родительский элемент
     * @param callbacks - обработчики find/replace и notebookId для resources-панели
     */
    public constructor(
        parent: HTMLElement,
        {
            onFind,
            onNext,
            onPrev,
            onReplace,
            onReplaceAll,
            notebookId
        }: NotebookSidebarCallbacks = {}
    ) {
        super(null, parent);
        this.#onFind = onFind;
        this.#onNext = onNext;
        this.#onPrev = onPrev;
        this.#onReplace = onReplace;
        this.#onReplaceAll = onReplaceAll;
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
                if (ke.shiftKey) {
                    if (this.#onPrev) this.#onPrev(q);
                } else if (this.#onNext) {
                    this.#onNext(q);
                }
            });
        }

        this._element.querySelectorAll('[data-action]').forEach((btn) => {
            const action = (btn as HTMLElement).dataset.action;
            this._addListener(btn, 'click', (e: Event) => {
                e.preventDefault();
                const q = this.getFindQuery();
                if (action === 'find' && this.#onFind) this.#onFind(q);
                else if (action === 'next' && this.#onNext) this.#onNext(q);
                else if (action === 'prev' && this.#onPrev) this.#onPrev(q);
                else if (action === 'replace' && this.#onReplace) this.#onReplace(q);
                else if (action === 'replace-all' && this.#onReplaceAll) this.#onReplaceAll(q);
            });
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
