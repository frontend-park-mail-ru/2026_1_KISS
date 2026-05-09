import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { StatsApi, type UserStats } from '../../shared/api/StatsApi.js';
import { ResourceBannerTemplate } from './ResourceBanner.template.js';
import { nn } from '../../shared/utils/notNull.js';

export class ResourceBanner extends BaseComponent {
    #api: StatsApi;

    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#api = new StatsApi();
        this.#render();
    }

    #render(): void {
        const tmp = document.createElement('div');
        tmp.innerHTML = ResourceBannerTemplate();
        this._element = tmp.firstElementChild as HTMLElement;
    }

    public mount(): void {
        super.mount();
        void this.#loadStats();
    }

    async #loadStats(): Promise<void> {
        try {
            const stats = await this.#api.getMyStats();
            this.#populate(stats);
        } catch {
            /* ignore */
        }
    }

    #populate(stats: UserStats): void {
        const planNames: Record<string, string> = {
            free: 'Free',
            freeze: 'Freeze',
            pro: 'Pro',
            max: 'Max',
            admin: 'Admin'
        };

        const badge = nn(this._element.querySelector('[data-field="plan"]'));
        badge.textContent = planNames[stats.quota.plan] || stats.quota.plan;
        badge.className = `resource-banner__badge resource-banner__badge--${stats.quota.plan}`;

        const quotaEl = nn(this._element.querySelector('[data-field="quota"]'));
        const fill = nn(this._element.querySelector<HTMLElement>('.resource-banner__progress-fill'));

        if (stats.quota.time_limit_seconds > 0) {
            const h = Math.floor(stats.quota.total_time_seconds / 3600);
            const m = Math.floor((stats.quota.total_time_seconds % 3600) / 60);
            const lh = Math.floor(stats.quota.time_limit_seconds / 3600);
            quotaEl.textContent = `${h}ч ${m}мин / ${lh}ч`;

            const pct = Math.min(100, stats.quota.usage_percent);
            fill.style.width = `${pct}%`;
            if (pct >= 80) fill.classList.add('resource-banner__progress-fill--warning');
        } else {
            quotaEl.textContent = 'Безлимит';
            fill.style.width = '0%';
        }

        const storageEl = nn(this._element.querySelector('[data-field="storage"]'));
        storageEl.textContent = this.#formatBytes(stats.storage.total_size_bytes);

        const nbEl = nn(this._element.querySelector('[data-field="notebooks"]'));
        nbEl.textContent = String(stats.resources.notebook_count);
    }

    #formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
