import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { PaymentApi } from '../../shared/api/PaymentApi.js';
import { logError } from '../../shared/utils/logger.js';
import { nn } from '../../shared/utils/notNull.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { SubscriptionSectionTemplate } from './SubscriptionSection.template.js';
import type { PlanDTO } from '../../shared/api/types.js';

/**
 * Внешний URL JS-библиотеки виджета ЮKassa Checkout. Загружается лениво
 * при первом старте оплаты — чтобы не тянуть скрипт на каждый профиль.
 */
const YOOKASSA_WIDGET_URL = 'https://yookassa.ru/checkout-widget/v1/checkout-widget.js';

/**
 * Форматирует копейки в строку рублей с двумя знаками. 99900 → "999.00".
 * @param kopeks - сумма в копейках
 * @returns строка с двумя знаками после точки
 */
function formatRubles(kopeks: number): string {
    const intPart = Math.floor(kopeks / 100);
    const fracPart = kopeks % 100;
    return `${String(intPart)}.${fracPart.toString().padStart(2, '0')}`;
}

/**
 * Минимальный контракт глобального конструктора виджета ЮKassa.
 * Подгружается из YOOKASSA_WIDGET_URL и появляется как window.YooMoneyCheckoutWidget.
 * Описано как opaque-тип — работаем только с конструктором и методами render/destroy.
 */
interface YooKassaWidget {
    /**
     * Рендерит платёжный интерфейс внутри элемента с указанным id.
     * @param containerId - id DOM-элемента
     */
    render(containerId: string): void;
    /**
     * Снимает виджет с DOM (нужно при unmount компонента).
     */
    destroy(): void;
}

/**
 * Конфиг конструктора виджета. confirmation_token — одноразовый токен,
 * полученный от нашего бэка на /payments/subscription.
 */
interface YooKassaWidgetConfig {
    /** Одноразовый токен платежа от ЮKassa */
    confirmation_token: string;
    /** URL возврата после успешной оплаты */
    return_url: string;
    /** Локализация (опционально) */
    customization?: { colors?: { control_primary?: string } };
    /** Колбэк ошибки */
    error_callback?: (error: unknown) => void;
}

/**
 * Расширение Window для типобезопасной работы с глобальным конструктором ЮKassa.
 */
interface WindowWithYooKassa extends Window {
    /** Глобальный конструктор виджета (появляется после загрузки скрипта) */
    YooMoneyCheckoutWidget?: new (cfg: YooKassaWidgetConfig) => YooKassaWidget;
}

/**
 * Конфиг SubscriptionSection — приходит из ProfilePage вместе с user.
 */
interface SubscriptionSectionConfig {
    /** Текущие данные пользователя (для отображения текущего плана) */
    user: Record<string, unknown> | null;
    /** Колбэк обновления user после успешной оплаты */
    onUserUpdate?: (user: Record<string, unknown>) => void;
}

/**
 * Описание тарифа для шаблона карточки.
 */
interface PlanCardData {
    /** Идентификатор плана для API ('pro' / 'max') */
    name: string;
    /** Заголовок карточки */
    title: string;
    /** Цена в копейках */
    priceKopeks: number;
    /** Список фич для отображения */
    features: string[];
}

/**
 * Заранее заданные тексты для карточек тарифов. Реальные цены/квоты приходят
 * из API (/subscription/plans), но описание UI задаётся локально.
 */
const PLAN_FEATURES: Record<string, string[]> = {
    pro: ['Безлимитное время работы', 'Расширенная квота запусков кода', 'Приоритет в очереди'],
    max: ['Всё из Pro', 'Максимальная квота запусков', 'Поддержка по email']
};

/**
 * Интервал поллинга статуса платежа в миллисекундах.
 */
const POLL_INTERVAL_MS = 2000;

/**
 * Секция оплаты подписки в профиле. Загружает доступные планы и текущую
 * подписку пользователя, рендерит карточки тарифов Pro/Max с кнопками
 * "Оплатить", при клике создаёт платёж в ЮKassa и встраивает их Checkout
 * Widget прямо в страницу. Параллельно поллит статус каждые 2 секунды;
 * при succeeded — апгрейдит локальный плана и подсвечивает успех.
 *
 * Тестовый режим: реальные деньги не списываются. Используется тестовая
 * карта ЮKassa.
 */
export class SubscriptionSection extends BaseComponent {
    #config: SubscriptionSectionConfig;
    #api: PaymentApi;
    #plans: PlanDTO[] = [];
    #pollTimer: number | null = null;
    #widget: YooKassaWidget | null = null;
    #scriptLoading: Promise<void> | null = null;

    /**
     * Создаёт секцию.
     * @param parent - родительский элемент
     * @param config - данные пользователя и onUserUpdate-колбэк
     */
    public constructor(parent: HTMLElement, config?: SubscriptionSectionConfig) {
        super(null, parent);
        this.#config = config ?? { user: null };
        this.#api = new PaymentApi();
        this.#render();
    }

    /**
     * Рендерит шаблон, монтируется в родителя и стартует асинхронную загрузку
     * планов и текущей подписки. Загрузка не блокирует отрисовку — поля
     * заполнятся когда придёт ответ.
     */
    public override mount(): void {
        super.mount();
        this.#attachStaticHandlers();
        void this.#initialize();
    }

    /**
     * Снимает все таймеры, разрушает виджет ЮKassa если был открыт, удаляет
     * элемент из DOM. Без этого иконки и iframe ЮKassa остаются висеть.
     */
    public override unmount(): void {
        this.#stopPolling();
        this.#destroyWidget();
        super.unmount();
    }

    /**
     * Создаёт корневой DOM-элемент компонента из шаблона.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = SubscriptionSectionTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Навешивает статичные обработчики (только закрытие виджета). Кнопки
     * оплаты добавляются динамически в #renderPlans.
     */
    #attachStaticHandlers(): void {
        const closeBtn = this._element.querySelector('[data-close]');
        this._addListener(closeBtn, 'click', () => {
            this.#destroyWidget();
            this.#stopPolling();
        });
    }

    /**
     * Загружает планы и текущую подписку параллельно, заполняет UI.
     * Ошибки логируются, но не падают на пользователя — секция останется
     * с пустыми/дефолтными значениями.
     */
    async #initialize(): Promise<void> {
        try {
            const [plansResp, subResp] = await Promise.all([
                this.#api.listPlans(),
                this.#api.getMySubscription()
            ]);
            this.#plans = plansResp.plans;
            this.#renderCurrent(subResp.plan, subResp.expires_at);
            this.#renderPlans(subResp.plan);
        } catch (err) {
            logError('SubscriptionSection.initialize', err);
            this.#renderCurrent('free');
            this.#renderPlans('free');
        }
    }

    /**
     * Заполняет карточку текущего плана именем тарифа и датой окончания
     * подписки (если она активна).
     * @param plan - текущий план пользователя
     * @param expiresAt - UNIX-таймстамп окончания подписки (опционально)
     */
    #renderCurrent(plan: string, expiresAt?: number): void {
        const card = this._element.querySelector('[data-current]');
        if (!card) return;
        const nameEl = card.querySelector('.subscription-section__plan-name');
        const descEl = card.querySelector('.subscription-section__plan-desc');
        const labelMap: Record<string, string> = {
            free: 'Бесплатный план',
            freeze: 'Заморожен (исчерпан лимит)',
            pro: 'Pro',
            max: 'Max',
            admin: 'Admin'
        };
        if (nameEl) nameEl.textContent = labelMap[plan] ?? plan;

        if (descEl) {
            if ((plan === 'pro' || plan === 'max') && expiresAt !== undefined && expiresAt > 0) {
                const date = new Date(expiresAt * 1000);
                descEl.textContent = `Активна до ${date.toLocaleDateString('ru-RU')}`;
            } else if (plan === 'free') {
                descEl.textContent = 'Базовый доступ. Лимит: 3 часа активности.';
            } else if (plan === 'freeze') {
                descEl.textContent = 'Лимит времени исчерпан. Оплатите подписку чтобы продолжить.';
            } else {
                descEl.textContent = '';
            }
        }
    }

    /**
     * Рендерит карточки доступных тарифов (Pro и Max) с кнопками "Оплатить".
     * Для текущего плана кнопка disabled и подсвечена.
     * @param currentPlan - текущий план пользователя
     */
    #renderPlans(currentPlan: string): void {
        const container = this._element.querySelector('[data-plans]');
        if (!container) return;
        container.innerHTML = '';

        const cards: PlanCardData[] = this.#plans
            .filter((p) => p.name === 'pro' || p.name === 'max')
            .map((p) => ({
                name: p.name,
                title: p.name === 'pro' ? 'Pro' : 'Max',
                priceKopeks: p.price_kopeks,
                features: PLAN_FEATURES[p.name] ?? []
            }));

        for (const card of cards) {
            const isCurrent = card.name === currentPlan;
            const div = document.createElement('div');
            div.className = `subscription-section__plan-card${isCurrent ? ' subscription-section__plan-card--current' : ''}`;
            div.innerHTML = `
                <h4 class="subscription-section__plan-card-title">${escapeHtml(card.title)}</h4>
                <div>
                    <div class="subscription-section__plan-card-price">${formatRubles(card.priceKopeks)} ₽</div>
                    <div class="subscription-section__plan-card-period">в месяц</div>
                </div>
                <ul class="subscription-section__plan-card-features">
                    ${card.features.map((f) => `<li>• ${escapeHtml(f)}</li>`).join('')}
                </ul>
                <button type="button" class="subscription-section__plan-card-button"
                        data-buy="${escapeHtml(card.name)}" ${isCurrent ? 'disabled' : ''}>
                    ${isCurrent ? 'Текущий план' : 'Оплатить'}
                </button>
            `;
            container.appendChild(div);
        }

        const buttons = this._element.querySelectorAll('[data-buy]');
        buttons.forEach((btn) => {
            this._addListener(btn, 'click', () => {
                const plan = (btn as HTMLElement).dataset.buy;
                if (plan === 'pro' || plan === 'max') {
                    void this.#startPayment(plan);
                }
            });
        });
    }

    /**
     * Стартует процесс оплаты: создаёт платёж на бэке, загружает (если ещё
     * нет) скрипт ЮKassa, монтирует виджет и запускает поллинг статуса.
     * @param plan - выбранный план ('pro' | 'max')
     */
    async #startPayment(plan: 'pro' | 'max'): Promise<void> {
        this.#showStatus('info', 'Создаём платёж...');
        try {
            const created = await this.#api.createSubscriptionPayment(plan);
            await this.#loadWidgetScript();

            this.#destroyWidget();
            const wrap = this._element.querySelector<HTMLElement>('[data-widget-wrap]');
            if (wrap) wrap.hidden = false;

            const W = (window as WindowWithYooKassa).YooMoneyCheckoutWidget;
            if (!W) {
                this.#showStatus('error', 'Не удалось загрузить виджет ЮKassa');
                return;
            }
            const widget: YooKassaWidget = new W({
                confirmation_token: created.confirmation_token,
                return_url: `${window.location.origin}/profile?section=subscription&payment=${created.payment_id}`,
                error_callback: (e: unknown): void => {
                    logError('YooKassa widget', e);
                    this.#showStatus('error', 'Ошибка виджета ЮKassa');
                }
            });
            widget.render('yookassa-payment-widget');
            this.#widget = widget;
            this.#showStatus(
                'info',
                `Сумма: ${formatRubles(created.amount_kopeks)} ₽. Введите данные тестовой карты.`
            );
            this.#startPolling(created.payment_id);
        } catch (err) {
            logError('SubscriptionSection.startPayment', err);
            this.#showStatus('error', 'Не удалось начать оплату. Попробуйте позже.');
        }
    }

    /**
     * Лениво подгружает JS-скрипт виджета ЮKassa один раз. Повторные вызовы
     * возвращают тот же промис.
     * @returns промис, который резолвится когда window.YooMoneyCheckoutWidget доступен
     */
    #loadWidgetScript(): Promise<void> {
        if ((window as WindowWithYooKassa).YooMoneyCheckoutWidget) {
            return Promise.resolve();
        }
        if (this.#scriptLoading) {
            return this.#scriptLoading;
        }
        this.#scriptLoading = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = YOOKASSA_WIDGET_URL;
            script.async = true;
            script.onload = (): void => {
                resolve();
            };
            script.onerror = (): void => {
                reject(new Error('failed to load yookassa widget script'));
            };
            document.head.appendChild(script);
        });
        return this.#scriptLoading;
    }

    /**
     * Запускает поллинг статуса платежа каждые 2 секунды. Останавливается
     * автоматически когда статус становится терминальным (succeeded/canceled).
     * @param paymentID - внутренний UUID платежа
     */
    #startPolling(paymentID: string): void {
        this.#stopPolling();
        this.#pollTimer = window.setInterval(() => {
            void this.#pollOnce(paymentID);
        }, POLL_INTERVAL_MS);
    }

    /**
     * Один тик поллинга: запрашивает статус, обрабатывает терминальные
     * состояния. Сетевые ошибки игнорирует молча — следующий тик попробует снова.
     * @param paymentID - внутренний UUID платежа
     */
    async #pollOnce(paymentID: string): Promise<void> {
        try {
            const resp = await this.#api.getPaymentStatus(paymentID);
            if (resp.status === 'succeeded') {
                this.#stopPolling();
                this.#destroyWidget();
                this.#showStatus('success', 'Оплата прошла успешно. Подписка активирована.');
                await this.#refreshAfterSuccess();
            } else if (resp.status === 'canceled') {
                this.#stopPolling();
                this.#destroyWidget();
                this.#showStatus('error', 'Платёж отменён');
            }
        } catch (_err) {
            // молчим — следующий тик повторит
        }
    }

    /**
     * Останавливает поллинг и сбрасывает таймер.
     */
    #stopPolling(): void {
        if (this.#pollTimer !== null) {
            window.clearInterval(this.#pollTimer);
            this.#pollTimer = null;
        }
    }

    /**
     * Уничтожает текущий виджет ЮKassa (если есть) и скрывает контейнер.
     */
    #destroyWidget(): void {
        if (this.#widget) {
            try {
                this.#widget.destroy();
            } catch (e) {
                logError('YooKassa widget destroy', e);
            }
            this.#widget = null;
        }
        const wrap = this._element.querySelector<HTMLElement>('[data-widget-wrap]');
        if (wrap) wrap.hidden = true;
        const container = document.getElementById('yookassa-payment-widget');
        if (container) container.innerHTML = '';
    }

    /**
     * После успешной оплаты перезагружает /auth/me, обновляет локальный user
     * через onUserUpdate, перерисовывает карточку текущего плана.
     */
    async #refreshAfterSuccess(): Promise<void> {
        try {
            const sub = await this.#api.getMySubscription();
            this.#renderCurrent(sub.plan, sub.expires_at);
            this.#renderPlans(sub.plan);
            if (this.#config.onUserUpdate && this.#config.user) {
                const updated: Record<string, unknown> = { ...this.#config.user, plan: sub.plan };
                this.#config.onUserUpdate(updated);
            }
        } catch (err) {
            logError('SubscriptionSection.refreshAfterSuccess', err);
        }
    }

    /**
     * Показывает текстовый статус под виджетом (info/success/error).
     * @param kind - тип сообщения для подбора цветовой схемы
     * @param text - сам текст для отображения
     */
    #showStatus(kind: 'info' | 'success' | 'error', text: string): void {
        const el = nn(this._element.querySelector<HTMLElement>('[data-status]'));
        el.hidden = false;
        el.textContent = text;
        el.className = `subscription-section__status subscription-section__status--${kind}`;
    }
}
