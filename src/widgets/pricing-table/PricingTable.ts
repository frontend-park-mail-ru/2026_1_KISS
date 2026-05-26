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
 * Описание тарифа в заголовке колонки.
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
}

/**
 * Тип значения ячейки в строке фич. Скаляр — конкретная подпись,
 * boolean — флаг доступности (V/X).
 */
type CellValue = string | boolean;

/**
 * Строка с фичей: лейбл + значения для трёх тарифов.
 */
interface FeatureRow {
    /** Тип строки — обычная строка с данными */
    kind: 'feature';
    /** Подпись фичи в левой колонке */
    label: string;
    /** Значения по тарифам (порядок: starter, developer, professional) */
    values: [CellValue, CellValue, CellValue];
}

/**
 * Строка-разделитель: подсвечивает категорию (например «LLM-чат»).
 */
interface GroupRow {
    /** Тип строки — заголовок группы */
    kind: 'group';
    /** Подпись группы */
    label: string;
}

/**
 * Объединённый тип для одной строки таблицы — либо фича со значениями,
 * либо заголовок группы.
 */
type TableRow = FeatureRow | GroupRow;

const PLAN_DEFINITIONS: [PlanDefinition, PlanDefinition, PlanDefinition] = [
    {
        id: 'starter',
        title: 'Starter',
        priceLabel: 'Бесплатно',
        period: 'навсегда',
        highlight: false
    },
    {
        id: 'developer',
        title: 'Developer',
        priceLabel: '999 ₽',
        period: 'в месяц',
        highlight: true
    },
    {
        id: 'professional',
        title: 'Professional',
        priceLabel: '1 999 ₽',
        period: 'в месяц',
        highlight: false
    }
];

const FEATURE_ROWS: TableRow[] = [
    { kind: 'group', label: 'Ресурсы' },
    {
        kind: 'feature',
        label: 'Хранилище файлов',
        values: ['128 МБ', '256 МБ', '512 МБ']
    },
    {
        kind: 'feature',
        label: 'Лимит активного времени',
        values: ['3 часа', 'Безлимит', 'Безлимит']
    },
    {
        kind: 'feature',
        label: 'Квота запусков кода в месяц',
        values: ['50 000', '100 000', '999 999']
    },
    { kind: 'group', label: 'LLM-чат' },
    {
        kind: 'feature',
        label: 'Запросов в день',
        values: ['20', '200', '1 000']
    },
    {
        kind: 'feature',
        label: 'Токенов в день',
        values: ['5 000', '100 000', '1 000 000']
    },
    {
        kind: 'feature',
        label: 'GPT-4o mini',
        values: [true, true, true]
    },
    {
        kind: 'feature',
        label: 'Claude 3.5 Haiku',
        values: [false, true, true]
    },
    {
        kind: 'feature',
        label: 'DeepSeek Chat',
        values: [false, false, true]
    },
    {
        kind: 'feature',
        label: 'Llama 3.1 70B',
        values: [false, false, true]
    },
    { kind: 'group', label: 'Поддержка' },
    {
        kind: 'feature',
        label: 'Приоритет в очереди исполнения',
        values: [false, true, true]
    },
    {
        kind: 'feature',
        label: 'Email-поддержка',
        values: [false, false, true]
    }
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
 * Виджет сравнения тарифов: рендерит одну таблицу с тремя колонками тарифов
 * и строками фич. Скалярные значения (хранилище, лимиты) показаны как числа,
 * boolean-фичи (доступ к конкретной LLM-модели) — как галочка V или крест X.
 * Работает в двух режимах: public (для лендинга и /pricing для гостей) и
 * authenticated (для встраивания в SubscriptionSection в профиле). Текущий
 * план пользователя подсвечивается и отключает свою CTA-кнопку.
 *
 * Виджет не загружает данные сам — все цены и фичи статичны (декларативные
 * PLAN_DEFINITIONS / FEATURE_ROWS), потому что отображаемые надписи это
 * маркетинговые подписи, не runtime-конфиг. Реальные лимиты enforced бэкендом.
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
     * Монтирует таблицу в родителя и рисует thead/tbody/tfoot.
     */
    public override mount(): void {
        super.mount();
        this.#renderTable();
    }

    /**
     * Перерисовывает таблицу с новым current-планом (например после оплаты).
     * Сохраняет существующие listeners — все обработчики переустанавливаются.
     * @param currentPlan - новое значение текущего плана пользователя
     */
    public refresh(currentPlan: string | undefined): void {
        this.#config = { ...this.#config, currentPlan };
        this._clearListeners();
        this.#renderTable();
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
     * Рендерит все три части таблицы: thead с тарифами и ценой, tbody со
     * строками фич, tfoot с CTA-кнопками.
     */
    #renderTable(): void {
        const current = normalizePlan(this.#config.currentPlan);
        this.#renderHead(current);
        this.#renderBody();
        this.#renderFoot(current);
    }

    /**
     * Рисует строку заголовка таблицы: пустую первую ячейку и три колонки
     * тарифов с названием, ценой, периодом и (для popular) бейджем.
     * @param current - канонический id текущего плана пользователя
     */
    #renderHead(current: PlanId | undefined): void {
        const thead = nn(this._element.querySelector<HTMLElement>('[data-thead]'));
        const cols = PLAN_DEFINITIONS.map((plan) => {
            const classes = ['pricing-table__col-head'];
            if (plan.highlight) classes.push('pricing-table__col-head--highlight');
            if (current === plan.id) classes.push('pricing-table__col-head--current');
            const badge = plan.highlight
                ? '<span class="pricing-table__col-badge">Популярный</span>'
                : '';
            return `
                <th scope="col" class="${classes.join(' ')}">
                    ${badge}
                    <div class="pricing-table__col-inner">
                        <span class="pricing-table__col-title">${escapeHtml(plan.title)}</span>
                        <span class="pricing-table__col-price">${escapeHtml(plan.priceLabel)}</span>
                        <span class="pricing-table__col-period">${escapeHtml(plan.period)}</span>
                    </div>
                </th>
            `;
        }).join('');
        thead.innerHTML = `<tr><th scope="col"></th>${cols}</tr>`;
    }

    /**
     * Рисует строки фич в tbody. Группы выводятся как одна объединённая ячейка
     * на всю ширину. У boolean-значений рендерится V или X.
     */
    #renderBody(): void {
        const tbody = nn(this._element.querySelector<HTMLElement>('[data-tbody]'));
        const html = FEATURE_ROWS.map((row) => {
            if (row.kind === 'group') {
                return `<tr class="pricing-table__group-row"><td colspan="4">${escapeHtml(row.label)}</td></tr>`;
            }
            const cells = row.values.map((v) => this.#renderCell(v)).join('');
            return `<tr><td>${escapeHtml(row.label)}</td>${cells}</tr>`;
        }).join('');
        tbody.innerHTML = html;
    }

    /**
     * Рендерит одну ячейку строки фич: для строки — текстовое значение,
     * для true — галочка V, для false — крестик X.
     * @param value - скалярное или булево значение фичи
     * @returns HTML-фрагмент <td>...</td>
     */
    #renderCell(value: CellValue): string {
        if (typeof value === 'boolean') {
            return value
                ? '<td class="pricing-table__cell-yes" aria-label="Доступно">V</td>'
                : '<td class="pricing-table__cell-no" aria-label="Недоступно">X</td>';
        }
        return `<td class="pricing-table__cell-value">${escapeHtml(value)}</td>`;
    }

    /**
     * Рисует tfoot с CTA-кнопками для каждой колонки. Делегирует обработчик
     * клика конфигу: onPublicCta в public-режиме, onSelectPlan в authenticated.
     * Кнопка под колонкой текущего плана disabled.
     * @param current - канонический id текущего плана пользователя
     */
    #renderFoot(current: PlanId | undefined): void {
        const tfoot = nn(this._element.querySelector<HTMLElement>('[data-tfoot]'));
        const cells = PLAN_DEFINITIONS.map(
            (plan) => `<td>${this.#renderCtaCell(plan.id, current)}</td>`
        ).join('');
        tfoot.innerHTML = `<tr><td></td>${cells}</tr>`;

        const buttons = this._element.querySelectorAll<HTMLButtonElement>('[data-plan]');
        buttons.forEach((btn) => {
            this._addListener(btn, 'click', () => {
                this.#handleCta(btn.dataset.plan);
            });
        });
    }

    /**
     * Решает чем заполнить футер-ячейку конкретной колонки: кнопкой
     * «Оплатить» / «Зарегистрироваться» / «Начать бесплатно», disabled-кнопкой
     * «Текущий план» или просто текстовой подписью «Доступен без оплаты»
     * (для Starter в authenticated-режиме, чтобы не выглядело как активная CTA).
     * @param planId - id тарифа в текущей колонке
     * @param current - канонический id текущего плана пользователя (или undefined)
     * @returns HTML-фрагмент содержимого <td>
     */
    #renderCtaCell(planId: PlanId, current: PlanId | undefined): string {
        const isCurrent = current === planId;
        if (this.#config.mode === 'authenticated' && planId === 'starter' && !isCurrent) {
            return '<span class="pricing-table__cta-text">Доступен без оплаты</span>';
        }
        const label = this.#ctaLabelFor(planId, current);
        return `
            <button type="button" class="pricing-table__cta" data-plan="${escapeHtml(planId)}"${isCurrent ? ' disabled' : ''}>
                ${escapeHtml(label)}
            </button>
        `;
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
