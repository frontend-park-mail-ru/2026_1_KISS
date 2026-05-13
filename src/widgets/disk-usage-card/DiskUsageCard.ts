import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { StorageApi } from '../../shared/api/StorageApi.js';
import type { FileUsageResponse } from '../../shared/api/types.js';
import { formatBytes } from '../../shared/utils/formatBytes.js';
import { nn } from '../../shared/utils/notNull.js';
import { logError } from '../../shared/utils/logger.js';
import { DiskUsageCardTemplate } from './DiskUsageCard.template.js';

/**
 * Опции DiskUsageCard: опциональный onClick делает карточку кликабельной
 * (например на главной — клик ведёт на /disk).
 */
export interface DiskUsageCardOptions {
    /**
     * Колбэк клика по карточке. Если задан — карточка становится кликабельной
     * (cursor: pointer, hover-эффект).
     */
    onClick?: () => void;
    /**
     * Включает компактный вариант: меньший padding, кегль, высота бара и
     * ограниченная max-width. Используется когда карточка встраивается в
     * страницу со своим контентом (например /files), а не как hero-блок.
     */
    compact?: boolean;
}

/**
 * Виджет «карточка заполненности диска»: прогресс-бар + текст «использовано
 * X из Y» + бейдж тарифа. Сам обращается к StorageApi.getUsage и
 * перерисовывается. Родитель вызывает refresh() после загрузки/удаления.
 *
 * Цвет полоски меняется в зависимости от процента: зелёный <70%, жёлтый
 * 70–90%, красный >=90%.
 */
export class DiskUsageCard extends BaseComponent {
    #options: DiskUsageCardOptions;
    #storage: StorageApi;

    /**
     * Создаёт карточку. Реальная вставка и первый запрос — в mount().
     * @param parent - родительский DOM-элемент
     * @param options - опции (onClick опционально)
     */
    public constructor(parent: HTMLElement, options: DiskUsageCardOptions = {}) {
        const root = document.createElement('div');
        root.innerHTML = DiskUsageCardTemplate();
        super(root.firstElementChild as HTMLElement, parent);
        this.#options = options;
        this.#storage = StorageApi.getInstance();
    }

    /**
     * Монтирует виджет, навешивает click-обработчик если задан onClick и
     * запускает первый refresh.
     */
    public override mount(): void {
        super.mount();
        if (this.#options.compact === true) {
            this._element.classList.add('disk-usage-card_compact');
        }
        if (this.#options.onClick) {
            this._element.classList.add('disk-usage-card_clickable');
            this._addListener(this._element, 'click', () => {
                this.#options.onClick?.();
            });
        }
        void this.refresh();
    }

    /**
     * Подтягивает свежие данные с бэка и перерисовывает прогресс-бар, надписи,
     * бейдж тарифа. При ошибке оставляет последние видимые значения и
     * пишет ошибку в лог (нет смысла мигать пустыми значениями при флапающем
     * соединении).
     */
    public async refresh(): Promise<void> {
        try {
            const usage = await this.#storage.getUsage();
            this.#render(usage);
        } catch (error: unknown) {
            logError('DiskUsageCard.refresh failed', error);
        }
    }

    /**
     * Применяет данные usage к DOM: ширина полоски, текст использования,
     * бейдж тарифа, класс цвета.
     * @param usage - данные с бэка о квоте
     */
    #render(usage: FileUsageResponse): void {
        const fill = nn(this._element.querySelector<HTMLElement>('.disk-usage-card__bar-fill'));
        const planLabel = nn(this._element.querySelector<HTMLElement>('.disk-usage-card__plan'));
        const usageLabel = nn(this._element.querySelector<HTMLElement>('.disk-usage-card__usage'));
        const countLabel = nn(this._element.querySelector<HTMLElement>('.disk-usage-card__count'));

        const limitForLabel = usage.unlimited ? null : usage.limit;
        const percent =
            usage.unlimited || usage.limit <= 0
                ? 0
                : Math.min(100, Math.round((usage.used / usage.limit) * 100));

        fill.style.width = `${String(percent)}%`;
        fill.classList.remove('disk-usage-card__bar-fill_warn', 'disk-usage-card__bar-fill_danger');
        if (percent >= 90) {
            fill.classList.add('disk-usage-card__bar-fill_danger');
        } else if (percent >= 70) {
            fill.classList.add('disk-usage-card__bar-fill_warn');
        }

        planLabel.textContent = usage.plan || 'free';

        if (limitForLabel === null) {
            usageLabel.textContent = `${formatBytes(usage.used)} использовано`;
        } else {
            usageLabel.textContent = `${formatBytes(usage.used)} из ${formatBytes(limitForLabel)}`;
        }
        countLabel.textContent = `${String(usage.files_count)} ${this.#pluralFiles(usage.files_count)}`;
    }

    /**
     * Возвращает корректную русскую форму слова «файл» для числительного.
     * @param n - количество файлов
     * @returns 'файл' / 'файла' / 'файлов'
     */
    #pluralFiles(n: number): string {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 14) return 'файлов';
        if (mod10 === 1) return 'файл';
        if (mod10 >= 2 && mod10 <= 4) return 'файла';
        return 'файлов';
    }
}
