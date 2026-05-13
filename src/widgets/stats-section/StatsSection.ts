import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { StatsApi, type UserStats } from '../../shared/api/StatsApi.js';
import { renderBarChart, fillDays } from '../../shared/utils/chart.js';
import { StatsSectionTemplate } from './StatsSection.template.js';
import { DiskUsageCard } from '../disk-usage-card/DiskUsageCard.js';
import { Router } from '../../shared/router/Router.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Секция статистики на странице профиля. Подгружает StatsApi.getMyStats при
 * mount и заполняет 5 секций: квота с прогресс-баром, инфо (даты + среднее),
 * KPI-карточки (notebook'и/блоки/запуски), график запусков за 30 дней,
 * список storage-категорий.
 *
 * Безлимитный план показывает "X — безлимитный план" вместо квоты и скрывает прогресс-бар.
 */
export class StatsSection extends BaseComponent {
    #api: StatsApi;
    #diskUsage: DiskUsageCard | null = null;

    /**
     * Создаёт и рендерит секцию. Загрузка данных откладывается до mount.
     * @param parent - родительский элемент
     */
    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#api = new StatsApi();
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tmp = document.createElement('div');
        tmp.innerHTML = StatsSectionTemplate();
        this._element = tmp.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит секцию и асинхронно подгружает данные.
     */
    public mount(): void {
        super.mount();
        const diskMount = this._element.querySelector<HTMLElement>(
            '.stats-section__disk-usage-mount'
        );
        if (diskMount) {
            this.#diskUsage = new DiskUsageCard(diskMount, {
                compact: true,
                onClick: (): void => {
                    nn(Router.getInstance()).navigate('/disk');
                }
            });
            this.#diskUsage.mount();
        }
        void this.#loadStats();
    }

    /**
     * Размонтирует секцию и встроенную карточку диска.
     */
    public override unmount(): void {
        this.#diskUsage?.unmount();
        this.#diskUsage = null;
        super.unmount();
    }

    /**
     * Загружает статистику и заполняет все 5 подсекций. Ошибки молча игнорирует
     * (UI остаётся с прочерками из шаблона).
     */
    async #loadStats(): Promise<void> {
        try {
            const stats = await this.#api.getMyStats();
            this.#populateQuota(stats);
            this.#populateInfo(stats);
            this.#populateKPI(stats);
            this.#populateChart(stats);
            this.#populateStorage(stats);
        } catch {
            /* ignore */
        }
    }

    /**
     * Заполняет блок квоты: бейдж плана с CSS-классом по идентификатору, текст
     * "Xч Yмин из Zч использовано", прогресс-бар с warning-классом при >=80%.
     * Для безлимитного плана прячет прогресс-бар.
     * @param stats - данные пользователя
     */
    #populateQuota(stats: UserStats): void {
        const badge = nn(this._element.querySelector('.stats-section__plan-badge'));
        const text = nn(this._element.querySelector('.stats-section__quota-text'));
        const fill = nn(this._element.querySelector<HTMLElement>('.stats-section__progress-fill'));

        const planNames: Record<string, string> = {
            free: 'Free',
            freeze: 'Freeze',
            pro: 'Pro',
            max: 'Max',
            admin: 'Admin'
        };
        badge.textContent = planNames[stats.quota.plan] || stats.quota.plan;
        badge.classList.add(`stats-section__plan-badge--${stats.quota.plan}`);

        if (stats.quota.time_limit_seconds > 0) {
            const used = this.#formatTime(stats.quota.total_time_seconds);
            const limit = this.#formatTime(stats.quota.time_limit_seconds);
            text.textContent = `${used} из ${limit} использовано`;

            const pct = Math.min(100, stats.quota.usage_percent);
            fill.style.width = `${String(pct)}%`;
            if (pct >= 80) fill.classList.add('stats-section__progress-fill--warning');
        } else {
            text.textContent = `${this.#formatTime(stats.quota.total_time_seconds)} — безлимитный план`;
            fill.style.width = '0%';
            nn(
                this._element.querySelector<HTMLElement>('.stats-section__progress-bar')
            ).style.display = 'none';
        }
    }

    /**
     * Заполняет инфо-блок: дата регистрации, последняя активность, среднее время
     * в день (рассчитывается как total_time / дней с регистрации).
     * @param stats - данные пользователя
     */
    #populateInfo(stats: UserStats): void {
        const set = (key: string, value: string): void => {
            const el = this._element.querySelector(`[data-info="${key}"]`);
            if (el) el.textContent = value;
        };

        if (stats.activity.created_at) {
            set('registered', new Date(stats.activity.created_at).toLocaleDateString('ru-RU'));
        }
        if (stats.activity.last_active_at) {
            set('last-active', new Date(stats.activity.last_active_at).toLocaleDateString('ru-RU'));
        }

        if (stats.activity.created_at && stats.quota.total_time_seconds > 0) {
            const regDate = new Date(stats.activity.created_at);
            const daysSince = Math.max(1, Math.floor((Date.now() - regDate.getTime()) / 86400000));
            const avgSeconds = Math.floor(stats.quota.total_time_seconds / daysSince);
            const m = Math.floor(avgSeconds / 60);
            set('avg-daily', `${String(m)} мин`);
        }
    }

    /**
     * Заполняет KPI-карточки: notebook'и, блоки кода, запуски.
     * @param stats - данные пользователя
     */
    #populateKPI(stats: UserStats): void {
        const set = (key: string, value: number): void => {
            const el = this._element.querySelector(`[data-kpi="${key}"]`);
            if (el) el.textContent = String(value);
        };
        set('notebooks', stats.resources.notebook_count);
        set('blocks', stats.resources.block_count);
        set('executions', stats.resources.total_executions);
    }

    /**
     * Заполняет SVG-график запусков за 30 дней. Использует fillDays чтобы
     * добить пропуски нулями и renderBarChart для генерации SVG.
     * @param stats - данные пользователя
     */
    #populateChart(stats: UserStats): void {
        const container = nn(this._element.querySelector('.stats-section__chart-container'));
        const filled = fillDays(stats.resources.daily_executions, 30);
        container.innerHTML = renderBarChart(filled, 'stats-section');
    }

    /**
     * Заполняет блок storage: карточка на каждую категорию (avatars/feedback/...)
     * с количеством файлов и суммарным размером + общая карточка "Всего".
     * При отсутствии файлов — заглушка.
     * @param stats - данные пользователя
     */
    #populateStorage(stats: UserStats): void {
        const container = nn(this._element.querySelector('.stats-section__storage-cards'));
        const categories = Object.keys(stats.storage.files_by_category);

        if (categories.length === 0) {
            container.innerHTML =
                '<span class="stats-section__storage-empty">Нет загруженных файлов</span>';
            return;
        }

        const catNames: Record<string, string> = {
            avatars: 'Аватары',
            feedback: 'Обратная связь',
            datasets: 'Датасеты',
            files: 'Файлы'
        };

        let html = '';
        categories.forEach((cat) => {
            const files = stats.storage.files_by_category[cat] || 0;
            const size = stats.storage.size_by_category[cat] || 0;
            html += `<div class="stats-section__storage-card">
                <div class="stats-section__storage-cat">${catNames[cat] || cat}</div>
                <div class="stats-section__storage-info">${String(files)} файл. / ${this.#formatBytes(size)}</div>
            </div>`;
        });
        html += `<div class="stats-section__storage-card stats-section__storage-card--total">
            <div class="stats-section__storage-cat">Всего</div>
            <div class="stats-section__storage-info">${String(stats.storage.total_files)} файл. / ${this.#formatBytes(stats.storage.total_size_bytes)}</div>
        </div>`;
        container.innerHTML = html;
    }

    /**
     * Форматирует секунды в "Xч Yмин".
     * @param seconds - время в секундах
     * @returns отформатированная строка
     */
    #formatTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${String(h)}ч ${String(m)}мин`;
    }

    /**
     * Форматирует байты в B / KB / MB.
     * @param bytes - размер в байтах
     * @returns отформатированная строка
     */
    #formatBytes(bytes: number): string {
        if (bytes < 1024) return `${String(bytes)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
