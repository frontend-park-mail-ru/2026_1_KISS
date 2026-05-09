import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { RunnerApi } from '../../shared/api/RunnerApi.js';
import { ContainerStatsTemplate } from './ContainerStats.template.js';
import { nn } from '../../shared/utils/notNull.js';

const POLL_INTERVAL = 3000;

/**
 * Компактная панель статистики docker-контейнера сессии (RAM/CPU + progress-bar).
 * Полит RunnerApi.getContainerStats каждые 3 секунды; при ошибке (контейнер не
 * запущен) переходит в неактивное состояние с прочерками.
 *
 * Цвет progress-bar меняется в зависимости от использования RAM:
 * < 60% — ok (зелёный), < 85% — warn (жёлтый), >= 85% — danger (красный).
 */
export class ContainerStats extends BaseComponent {
    #api: RunnerApi;
    #notebookId: number | string;
    #timer: ReturnType<typeof setInterval> | null = null;

    /**
     * Создаёт компонент с привязкой к notebook'у. Поллинг стартует при mount.
     * @param parent - родительский элемент
     * @param config - объект с notebookId
     */
    public constructor(parent: HTMLElement, config: { notebookId: number | string }) {
        super(null, parent);
        this.#api = new RunnerApi();
        this.#notebookId = config.notebookId;
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tmp = document.createElement('div');
        tmp.innerHTML = ContainerStatsTemplate();
        this._element = tmp.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит и сразу запускает поллинг (первый poll синхронно).
     */
    public mount(): void {
        super.mount();
        this.#startPolling();
    }

    /**
     * Останавливает поллинг и снимает с DOM.
     */
    public unmount(): void {
        this.#stopPolling();
        super.unmount();
    }

    /**
     * Запускает периодический поллинг (первый запрос — сразу, потом каждые
     * POLL_INTERVAL миллисекунд).
     */
    #startPolling(): void {
        void this.#poll();
        this.#timer = setInterval(() => this.#poll(), POLL_INTERVAL);
    }

    /**
     * Останавливает поллинг если активен.
     */
    #stopPolling(): void {
        if (this.#timer !== null) {
            clearInterval(this.#timer);
            this.#timer = null;
        }
    }

    /**
     * Один тик поллинга: запрашивает статистику и обновляет UI; при ошибке —
     * переходит в неактивное состояние (прочерки).
     */
    async #poll(): Promise<void> {
        try {
            const stats = await this.#api.getContainerStats(this.#notebookId);
            this.#update(stats);
        } catch {
            this.#setInactive();
        }
    }

    /**
     * Обновляет значения RAM/CPU и заполняет прогресс-бар. Класс bar-fill
     * меняется по порогам 60/85% для цветовой индикации нагрузки.
     * @param stats - данные от RunnerApi
     */
    #update(stats: {
        cpu_percent: number;
        memory_usage: number;
        memory_limit: number;
        memory_percent: number;
    }): void {
        this._element.classList.remove('container-stats--inactive');

        const ramEl = nn(this._element.querySelector('[data-metric="ram"]'));
        const cpuEl = nn(this._element.querySelector('[data-metric="cpu"]'));
        const fill = nn(this._element.querySelector<HTMLElement>('.container-stats__bar-fill'));

        const usedMB = (stats.memory_usage / (1024 * 1024)).toFixed(0);
        const limitMB = (stats.memory_limit / (1024 * 1024)).toFixed(0);
        ramEl.textContent = `${usedMB} / ${limitMB} MB`;
        cpuEl.textContent = `${stats.cpu_percent.toFixed(1)}%`;

        const pct = Math.min(100, stats.memory_percent);
        fill.style.width = `${String(pct)}%`;

        fill.classList.remove(
            'container-stats__bar-fill--ok',
            'container-stats__bar-fill--warn',
            'container-stats__bar-fill--danger'
        );
        if (pct < 60) fill.classList.add('container-stats__bar-fill--ok');
        else if (pct < 85) fill.classList.add('container-stats__bar-fill--warn');
        else fill.classList.add('container-stats__bar-fill--danger');
    }

    /**
     * Переводит UI в неактивное состояние (контейнер не запущен): добавляет
     * CSS-класс и заменяет значения на прочерки.
     */
    #setInactive(): void {
        this._element.classList.add('container-stats--inactive');
        const ramEl = nn(this._element.querySelector('[data-metric="ram"]'));
        const cpuEl = nn(this._element.querySelector('[data-metric="cpu"]'));
        ramEl.textContent = '—';
        cpuEl.textContent = '—';
    }
}
