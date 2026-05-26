import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { StatsApi, type UserStats } from '../../shared/api/StatsApi.js';
import { ResourceBannerTemplate } from './ResourceBanner.template.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Баннер с информацией о квоте/ресурсах текущего пользователя в шапке файлов.
 * Подгружает StatsApi.getMyStats при mount и заполняет бейдж плана, прогресс-бар
 * квоты времени, размер хранилища и количество ноутбуков.
 *
 * Прогресс-бар получает класс --warning при использовании >= 80% квоты.
 * Безлимитный план показывает "Безлимит" вместо прогресс-бара.
 */
export class ResourceBanner extends BaseComponent {
    #api: StatsApi;

    /**
     * Создаёт и рендерит баннер. Загрузка статистики откладывается до mount.
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
        tmp.innerHTML = ResourceBannerTemplate();
        this._element = tmp.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит и асинхронно подгружает статистику.
     */
    public mount(): void {
        super.mount();
        void this.#loadStats();
    }

    /**
     * Загружает статистику с сервера и заполняет UI; ошибки молча игнорирует
     * (баннер просто остаётся с прочерками).
     */
    async #loadStats(): Promise<void> {
        try {
            const stats = await this.#api.getMyStats();
            this.#populate(stats);
        } catch {
            /* ignore */
        }
    }

    /**
     * Заполняет все значения баннера данными UserStats. Маппит machine-имя плана
     * (starter/developer/professional/freeze/admin) в человекочитаемое; для
     * совместимости со старыми ответами /stats принимает legacy free/pro/max.
     * Форматирует время как "Xч Yмин / Zч"; для безлимита — "Безлимит".
     * @param stats - статистика пользователя от StatsApi
     */
    #populate(stats: UserStats): void {
        const planNames: Record<string, string> = {
            starter: 'Starter',
            developer: 'Developer',
            professional: 'Professional',
            freeze: 'Freeze',
            admin: 'Admin',
            free: 'Starter',
            pro: 'Developer',
            max: 'Professional'
        };

        const badge = nn(this._element.querySelector('[data-field="plan"]'));
        badge.textContent = planNames[stats.quota.plan] || stats.quota.plan;
        badge.className = `resource-banner__badge resource-banner__badge--${stats.quota.plan}`;

        const quotaEl = nn(this._element.querySelector('[data-field="quota"]'));
        const fill = nn(
            this._element.querySelector<HTMLElement>('.resource-banner__progress-fill')
        );

        if (stats.quota.time_limit_seconds > 0) {
            const h = Math.floor(stats.quota.total_time_seconds / 3600);
            const m = Math.floor((stats.quota.total_time_seconds % 3600) / 60);
            const lh = Math.floor(stats.quota.time_limit_seconds / 3600);
            quotaEl.textContent = `${String(h)}ч ${String(m)}мин / ${String(lh)}ч`;

            const pct = Math.min(100, stats.quota.usage_percent);
            fill.style.width = `${String(pct)}%`;
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

    /**
     * Форматирует число байт в человекочитаемую строку: B / KB / MB.
     * @param bytes - размер в байтах
     * @returns отформатированная строка с единицей
     */
    #formatBytes(bytes: number): string {
        if (bytes < 1024) return `${String(bytes)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
