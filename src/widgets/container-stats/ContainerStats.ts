import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { StatsWS } from '../../shared/api/StatsWS.js';
import { ContainerStatsTemplate } from './ContainerStats.template.js';
import { nn } from '../../shared/utils/notNull.js';
import type { ContainerStatsDTO } from '../../shared/api/types.js';

/**
 * Компактная панель статистики docker-контейнера сессии (RAM/CPU + progress-bar).
 * Полит RunnerApi.getContainerStats каждые 3 секунды; при ошибке (контейнер не
 * запущен) переходит в неактивное состояние с прочерками.
 *
 * Цвет progress-bar меняется в зависимости от использования RAM:
 * < 60% — ok (зелёный), < 85% — warn (жёлтый), >= 85% — danger (красный).
 */
export class ContainerStats extends BaseComponent {
    #ws: StatsWS;

    /**
     * Создаёт компонент с привязкой к notebook'у. Поллинг стартует при mount.
     * @param parent - родительский элемент
     * @param config - объект с notebookId
     */
    public constructor(parent: HTMLElement, config: { notebookId: number | string }) {
        super(null, parent);
        this.#ws = new StatsWS(
            config.notebookId,
            (stats) => {
                this.#update(stats);
            },
            {
                onClose: (): void => {
                    this.#setInactive();
                }
            }
        );
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
        this.#ws.connect();
    }

    /**
     * Закрывает StatsWS (с него больше не придут кадры) и размонтирует DOM.
     */
    public unmount(): void {
        this.#ws.close();
        super.unmount();
    }

    /**
     * Обновляет значения RAM/CPU и заполняет прогресс-бар. Класс bar-fill
     * меняется по порогам 60/85% для цветовой индикации нагрузки.
     * @param stats - данные от RunnerApi
     */
    #update(stats: ContainerStatsDTO): void {
        if (stats.session_state === 'inactive') {
            this.#setInactive();
            return;
        }

        this._element.classList.remove('container-stats--inactive');

        const ramEl = nn(this._element.querySelector('[data-metric="ram"]'));
        const cpuEl = nn(this._element.querySelector('[data-metric="cpu"]'));
        const fill = nn(this._element.querySelector<HTMLElement>('.container-stats__bar-fill'));

        if (stats.session_state === 'queued') {
            ramEl.textContent = `Очередь: ${String(stats.queue_position)}`;
            cpuEl.textContent = '—';
            fill.style.width = '0%';
            return;
        }

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
