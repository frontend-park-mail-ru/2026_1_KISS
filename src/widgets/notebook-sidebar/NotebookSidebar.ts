import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { RunnerApi } from '../../shared/api/RunnerApi.js';
import { NotebookSidebarTemplate } from './NotebookSidebar.template.js';

interface FindQuery {
    query: string;
    replacement: string;
    caseSensitive: boolean;
}

interface NotebookSidebarCallbacks {
    onFind?: (q: FindQuery) => void;
    onNext?: (q: FindQuery) => void;
    onPrev?: (q: FindQuery) => void;
    onReplace?: (q: FindQuery) => void;
    onReplaceAll?: (q: FindQuery) => void;
    notebookId?: string | number;
}

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

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = NotebookSidebarTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    public unmount(): void {
        if (!this._isMounted) return;
        this.#stopContainerPolling();
        super.unmount();
    }

    public setMatchCount(currentIdx: number, total: number): void {
        const el = this._element.querySelector('.notebook-sidebar__match-count');
        if (!el) return;
        el.textContent = total === 0 ? '0 / 0' : `${currentIdx + 1} / ${total}`;
    }

    public getFindQuery(): FindQuery {
        const findInput = this._element.querySelector(
            '.notebook-sidebar__find-input'
        );
        const replaceInput = this._element.querySelector(
            '.notebook-sidebar__replace-input'
        );
        const caseToggle = this._element.querySelector(
            '.notebook-sidebar__case-toggle'
        );
        return {
            query: findInput ? findInput.value : '',
            replacement: replaceInput ? replaceInput.value : '',
            caseSensitive: caseToggle ? caseToggle.checked : false
        };
    }

    #attachEvents(): void {
        this._element.querySelectorAll('.notebook-sidebar__icon-btn').forEach((btn) => {
            this._addListener(btn, 'click', () => {
                const panel = (btn as HTMLElement).dataset.panel!;
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

    #closePanel(): void {
        if (!this.#activePanel) return;
        if (this.#activePanel === 'resources') this.#stopContainerPolling();
        const btn = this._element.querySelector(`[data-panel="${this.#activePanel}"]`);
        if (btn) btn.classList.remove('notebook-sidebar__icon-btn--active');
        const panel = this._element.querySelector(`.notebook-sidebar__panel--${this.#activePanel}`);
        if (panel) panel.classList.remove('notebook-sidebar__panel--visible');
        this.#activePanel = null;
    }

    #startContainerPolling(): void {
        this.#pollContainer();
        this.#containerPollTimer = setInterval(() => this.#pollContainer(), 3000);
    }

    #stopContainerPolling(): void {
        if (this.#containerPollTimer) {
            clearInterval(this.#containerPollTimer);
            this.#containerPollTimer = null;
        }
    }

    async #pollContainer(): Promise<void> {
        if (!this.#notebookId) return;
        const panel = this._element.querySelector('.container-stats--sidebar');
        if (!panel) return;

        try {
            const stats = await this.#runnerApi.getContainerStats(this.#notebookId);
            panel.classList.remove('container-stats--inactive');

            const ramEl = panel.querySelector('[data-metric="ram"]')!;
            const cpuEl = panel.querySelector('[data-metric="cpu"]')!;
            const coresEl = panel.querySelector('[data-metric="cores"]')!;
            const diskEl = panel.querySelector('[data-metric="disk"]')!;
            const gpuEl = panel.querySelector('[data-metric="gpu"]')!;
            const fill = panel.querySelector('.container-stats__bar-fill')!;

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
            fill.style.width = `${pct}%`;
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

    #renderSparklines(panel: HTMLElement): void {
        const ramContainer = panel.querySelector('[data-sparkline="ram"]');
        const cpuContainer = panel.querySelector('[data-sparkline="cpu"]');
        if (ramContainer)
            ramContainer.innerHTML = this.#sparklineSvg(this.#ramHistory, 100, 'var(--teal-green)');
        if (cpuContainer)
            cpuContainer.innerHTML = this.#sparklineSvg(this.#cpuHistory, 100, '#ff9800');
    }

    #sparklineSvg(data: number[], maxVal: number, color: string): string {
        if (data.length < 2) return '';
        const w = 218;
        const h = 30;
        const step = w / (data.length - 1);
        const points = data
            .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / maxVal) * h).toFixed(1)}`)
            .join(' ');
        const areaPoints = `0,${h} ${points} ${((data.length - 1) * step).toFixed(1)},${h}`;
        return `<svg viewBox="0 0 ${w} ${h}" class="container-stats__sparkline-svg"><polygon points="${areaPoints}" fill="${color}" opacity="0.15"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
    }
}
