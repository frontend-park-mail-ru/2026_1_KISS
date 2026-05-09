import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { RunnerApi } from '../../shared/api/RunnerApi.js';
import { ContainerStatsTemplate } from './ContainerStats.template.js';

const POLL_INTERVAL = 3000;

export class ContainerStats extends BaseComponent {
    #api: RunnerApi;
    #notebookId: number | string;
    #timer: ReturnType<typeof setInterval> | null = null;

    constructor(parent: HTMLElement, config: { notebookId: number | string }) {
        super(null, parent);
        this.#api = new RunnerApi();
        this.#notebookId = config.notebookId;
        this.#render();
    }

    #render(): void {
        const tmp = document.createElement('div');
        tmp.innerHTML = ContainerStatsTemplate();
        this._element = tmp.firstElementChild as HTMLElement;
    }

    mount(): void {
        super.mount();
        this.#startPolling();
    }

    unmount(): void {
        this.#stopPolling();
        super.unmount();
    }

    #startPolling(): void {
        this.#poll();
        this.#timer = setInterval(() => this.#poll(), POLL_INTERVAL);
    }

    #stopPolling(): void {
        if (this.#timer) {
            clearInterval(this.#timer);
            this.#timer = null;
        }
    }

    async #poll(): Promise<void> {
        try {
            const stats = await this.#api.getContainerStats(this.#notebookId);
            this.#update(stats);
        } catch {
            this.#setInactive();
        }
    }

    #update(stats: {
        cpu_percent: number;
        memory_usage: number;
        memory_limit: number;
        memory_percent: number;
    }): void {
        this._element.classList.remove('container-stats--inactive');

        const ramEl = this._element.querySelector('[data-metric="ram"]')!;
        const cpuEl = this._element.querySelector('[data-metric="cpu"]')!;
        const fill = this._element.querySelector('.container-stats__bar-fill')!;

        const usedMB = (stats.memory_usage / (1024 * 1024)).toFixed(0);
        const limitMB = (stats.memory_limit / (1024 * 1024)).toFixed(0);
        ramEl.textContent = `${usedMB} / ${limitMB} MB`;
        cpuEl.textContent = `${stats.cpu_percent.toFixed(1)}%`;

        const pct = Math.min(100, stats.memory_percent);
        fill.style.width = `${pct}%`;

        fill.classList.remove(
            'container-stats__bar-fill--ok',
            'container-stats__bar-fill--warn',
            'container-stats__bar-fill--danger'
        );
        if (pct < 60) fill.classList.add('container-stats__bar-fill--ok');
        else if (pct < 85) fill.classList.add('container-stats__bar-fill--warn');
        else fill.classList.add('container-stats__bar-fill--danger');
    }

    #setInactive(): void {
        this._element.classList.add('container-stats--inactive');
        const ramEl = this._element.querySelector('[data-metric="ram"]')!;
        const cpuEl = this._element.querySelector('[data-metric="cpu"]')!;
        ramEl.textContent = '—';
        cpuEl.textContent = '—';
    }
}
