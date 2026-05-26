import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { nn } from '../../shared/utils/notNull.js';
import { PricingTableTemplate } from './PricingTable.template.js';

/**
 * Канонический идентификатор тарифа на бэкенде после миграции 031.
 */
export type PlanId = 'starter' | 'developer' | 'professional';

/**
 * Режим отображения таблицы. В public CTA ведут на страницу регистрации,
 * в authenticated — на оплату либо отметку "Текущий план".
 */
export type PricingTableMode = 'public' | 'authenticated';

/**
 * Конфигурация виджета сравнения тарифов.
 */
export interface PricingTableConfig {
    /** Режим: гость (public) или авторизованный (authenticated) */
    mode: PricingTableMode;
    /** Текущий план пользователя (может быть legacy 'pro'/'max') — нормализуется внутри */
    currentPlan?: string;
    /** Колбэк выбора платного плана из authenticated-режима */
    onSelectPlan?: (plan: PlanId) => void;
    /** Колбэк выбора плана из public-режима (обычно навигация на /sign) */
    onPublicCta?: (plan: PlanId) => void;
}

/**
 * Описание одной колонки тарифа: визуальные строки и метки.
 */
interface PlanDefinition {
    /** Идентификатор тарифа */
    id: PlanId;
    /** Отображаемый заголовок */
    title: string;
    /** Подпись цены (например '999 ₽' или 'Бесплатно') */
    priceLabel: string;
    /** Подпись периода под ценой */
    period: string;
    /** Подсветить как «популярный» */
    highlight: boolean;
    /** Тексты значений для каждой строки сравнения, ключ — id строки */
    values: Record<string, string>;
}

/**
 * Описание одной строки в таблице сравнения.
 */
interface FeatureRow {
    /** Идентификатор строки (используется как ключ в PlanDefinition.values) */
    key: string;
    /** Подпись строки слева */
    label: string;
}

const PLAN_DEFINITIONS: PlanDefinition[] = [
    {
        id: 'starter',
        title: 'Starter',
        priceLabel: 'Бесплатно',
        period: 'навсегда',
        highlight: false,
        values: {
            activeTime: '3 часа активного времени',
            execQuota: 'Базовая квота запусков кода',
            llmModels: 'gpt-oss базовый'
        }
    },
    {
        id: 'developer',
        title: 'Developer',
        priceLabel: '999 ₽',
        period: 'в месяц',
        highlight: true,
        values: {
            activeTime: 'Неограниченное время',
            execQuota: 'Расширенная квота запусков',
            llmModels: 'gpt-oss базовый + улучшенные модели'
        }
    },
    {
        id: 'professional',
        title: 'Professional',
        priceLabel: '1 999 ₽',
        period: 'в месяц',
        highlight: false,
        values: {
            activeTime: 'Неограниченное время',
            execQuota: 'Максимальная квота запусков',
            llmModels: 'Полный доступ ко всем моделям'
        }
    }
];

const FEATURE_ROWS: FeatureRow[] = [
    { key: 'activeTime', label: 'Лимит активного времени' },
    { key: 'execQuota', label: 'Квота запусков кода' },
    { key: 'llmModels', label: 'Доступные LLM-модели' }
];

const PLAN_ALIASES: Record<string, PlanId> = {
    free: 'starter',
    pro: 'developer',
    max: 'professional',
    starter: 'starter',
    developer: 'developer',
    professional: 'professional'
};

/**
 * Приводит legacy-имя плана ('free'/'pro'/'max') к каноническому идентификатору.
 * Возвращает undefined если входной план не распознан как канонический или алиас
 * (например 'admin'/'freeze' — мы их не отображаем в таблице как «текущий»).
 * @param plan - произвольная строка имени плана (может быть undefined)
 * @returns канонический PlanId или undefined
 */
function normalizePlan(plan: string | undefined): PlanId | undefined {
    if (plan === undefined) return undefined;
    return PLAN_ALIASES[plan];
}

/**
 * Виджет сравнения тарифов: рендерит три колонки (Starter, Developer,
 * Professional) и таблицу с фичами под ними. Работает в двух режимах:
 * public (для лендинга и страницы /pricing для гостей) и authenticated
 * (для встраивания в SubscriptionSection в профиле). Подсветка «популярного»
 * тарифа и определение текущего плана пользователя — на стороне виджета.
 *
 * Виджет не загружает данные сам — все цены и фичи статичны (декларативные
 * PLAN_DEFINITIONS), потому что отображаемые надписи это маркетинговые
 * подписи, не runtime-конфиг. Реальные цены проверяются бэкендом при оплате.
 */
export class PricingTable extends BaseComponent {
    #config: PricingTableConfig;

    /**
     * Создаёт виджет. element собирается из шаблона в #render до super.mount.
     * @param parent - родительский DOM-элемент в который вмонтируется таблица
     * @param config - режим и колбэки выбора тарифа
     */
    public constructor(parent: HTMLElement, config: PricingTableConfig) {
        super(null, parent);
        this.#config = config;
        this.#render();
    }

    /**
     * Монтирует таблицу в родителя и рисует колонки/строки.
     */
    public override mount(): void {
        super.mount();
        this.#renderColumns();
        this.#renderRows();
    }

    /**
     * Перерисовывает таблицу с новым current-планом (например после оплаты).
     * Сохраняет существующие listeners — все обработчики переустанавливаются.
     * @param currentPlan - новое значение текущего плана пользователя
     */
    public refresh(currentPlan: string | undefined): void {
        this.#config = { ...this.#config, currentPlan };
        this._clearListeners();
        this.#renderColumns();
    }

    /**
     * Создаёт корневой элемент из шаблона. _element устанавливается до super.mount().
     */
    #render(): void {
        const tmp = document.createElement('div');
        tmp.innerHTML = PricingTableTemplate();
        this._element = nn(tmp.firstElementChild) as HTMLElement;
    }

    /**
     * Рисует три карточки тарифов с ценами и CTA-кнопками. Подсвечивает
     * текущий план (если задан) и «популярный» столбец.
     */
    #renderColumns(): void {
        const container = nn(this._element.querySelector<HTMLElement>('[data-columns]'));
        container.innerHTML = '';

        const current = normalizePlan(this.#config.currentPlan);

        for (const plan of PLAN_DEFINITIONS) {
            const card = document.createElement('div');
            const classes = ['pricing-table__column'];
            if (plan.highlight) classes.push('pricing-table__column--highlight');
            if (current === plan.id) classes.push('pricing-table__column--current');
            card.className = classes.join(' ');

            const ctaLabel = this.#ctaLabelFor(plan.id, current);
            const ctaDisabled = current === plan.id;

            card.innerHTML = `
                ${plan.highlight ? '<span class="pricing-table__badge">Популярный</span>' : ''}
                <h3 class="pricing-table__column-title">${escapeHtml(plan.title)}</h3>
                <div>
                    <div class="pricing-table__column-price">${escapeHtml(plan.priceLabel)}</div>
                    <div class="pricing-table__column-period">${escapeHtml(plan.period)}</div>
                </div>
                <button type="button" class="pricing-table__column-cta" data-plan="${escapeHtml(plan.id)}"${ctaDisabled ? ' disabled' : ''}>
                    ${escapeHtml(ctaLabel)}
                </button>
            `;
            container.appendChild(card);
        }

        const buttons = this._element.querySelectorAll<HTMLButtonElement>('[data-plan]');
        buttons.forEach((btn) => {
            this._addListener(btn, 'click', () => {
                this.#handleCta(btn.dataset.plan);
            });
        });
    }

    /**
     * Рисует таблицу сравнения фич: одна строка на FeatureRow,
     * первый столбец — лейбл, остальные три — значения для каждого тарифа.
     */
    #renderRows(): void {
        const container = nn(this._element.querySelector<HTMLElement>('[data-rows]'));
        container.innerHTML = '';

        for (const row of FEATURE_ROWS) {
            const div = document.createElement('div');
            div.className = 'pricing-table__row';
            const values = PLAN_DEFINITIONS.map((p) => {
                const cls = p.highlight
                    ? 'pricing-table__row-value pricing-table__row-value--highlight'
                    : 'pricing-table__row-value';
                return `<div class="${cls}">${escapeHtml(p.values[row.key] ?? '')}</div>`;
            }).join('');
            div.innerHTML = `
                <div class="pricing-table__row-label">${escapeHtml(row.label)}</div>
                ${values}
            `;
            container.appendChild(div);
        }
    }

    /**
     * Возвращает подпись CTA-кнопки для конкретного тарифа исходя из режима
     * и совпадения с текущим планом пользователя.
     * @param planId - id тарифа в текущей колонке
     * @param current - канонический id текущего плана (или undefined)
     * @returns строку для кнопки
     */
    #ctaLabelFor(planId: PlanId, current: PlanId | undefined): string {
        if (current === planId) return 'Текущий план';
        if (this.#config.mode === 'public') {
            return planId === 'starter' ? 'Начать бесплатно' : 'Зарегистрироваться';
        }
        if (planId === 'starter') return 'Доступен без оплаты';
        return 'Оплатить';
    }

    /**
     * Обработчик клика по CTA-кнопке: маршрутизирует на нужный колбэк в
     * зависимости от режима. Принимает значение из data-plan атрибута.
     * @param plan - id выбранного тарифа из data-plan (или undefined)
     */
    #handleCta(plan: string | undefined): void {
        if (plan !== 'starter' && plan !== 'developer' && plan !== 'professional') {
            return;
        }
        if (this.#config.mode === 'public') {
            this.#config.onPublicCta?.(plan);
            return;
        }
        if (plan === 'starter') return;
        this.#config.onSelectPlan?.(plan);
    }
}
