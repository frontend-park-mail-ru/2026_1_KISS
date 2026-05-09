import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { StatsApi, type UserStats } from '../../shared/api/StatsApi.js';
import { renderBarChart, fillDays } from '../../shared/utils/chart.js';
import { StatsSectionTemplate } from './StatsSection.template.js';

export class StatsSection extends BaseComponent {
    #api: StatsApi;

    constructor(parent: HTMLElement) {
        super(null, parent);
        this.#api = new StatsApi();
        this.#render();
    }

    #render(): void {
        const tmp = document.createElement('div');
        tmp.innerHTML = StatsSectionTemplate();
        this._element = tmp.firstElementChild as HTMLElement;
    }

    mount(): void {
        super.mount();
        this.#loadStats();
    }

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

    #populateQuota(stats: UserStats): void {
        const badge = this._element.querySelector('.stats-section__plan-badge')!;
        const text = this._element.querySelector('.stats-section__quota-text')!;
        const fill = this._element.querySelector('.stats-section__progress-fill')!;

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
            fill.style.width = `${pct}%`;
            if (pct >= 80) fill.classList.add('stats-section__progress-fill--warning');
        } else {
            text.textContent = `${this.#formatTime(stats.quota.total_time_seconds)} — безлимитный план`;
            fill.style.width = '0%';
            (
                this._element.querySelector('.stats-section__progress-bar')!
            ).style.display = 'none';
        }
    }

    #populateInfo(stats: UserStats): void {
        const set = (key: string, value: string) => {
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
            set('avg-daily', `${m} мин`);
        }
    }

    #populateKPI(stats: UserStats): void {
        const set = (key: string, value: number) => {
            const el = this._element.querySelector(`[data-kpi="${key}"]`);
            if (el) el.textContent = String(value);
        };
        set('notebooks', stats.resources.notebook_count);
        set('blocks', stats.resources.block_count);
        set('executions', stats.resources.total_executions);
    }

    #populateChart(stats: UserStats): void {
        const container = this._element.querySelector(
            '.stats-section__chart-container'
        )!;
        const filled = fillDays(stats.resources.daily_executions || [], 30);
        container.innerHTML = renderBarChart(filled, 'stats-section');
    }

    #populateStorage(stats: UserStats): void {
        const container = this._element.querySelector(
            '.stats-section__storage-cards'
        )!;
        const categories = Object.keys(stats.storage.files_by_category || {});

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
                <div class="stats-section__storage-info">${files} файл. / ${this.#formatBytes(size)}</div>
            </div>`;
        });
        html += `<div class="stats-section__storage-card stats-section__storage-card--total">
            <div class="stats-section__storage-cat">Всего</div>
            <div class="stats-section__storage-info">${stats.storage.total_files} файл. / ${this.#formatBytes(stats.storage.total_size_bytes)}</div>
        </div>`;
        container.innerHTML = html;
    }

    #formatTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}ч ${m}мин`;
    }

    #formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
