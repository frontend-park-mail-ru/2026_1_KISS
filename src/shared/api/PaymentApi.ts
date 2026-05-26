import { HttpClient } from '../http_client/HttpClient.js';
import type {
    ApiEnvelope,
    CreatePaymentResponse,
    MySubscriptionResponse,
    PaymentStatusResponse,
    PlanListResponse
} from './types.js';

/**
 * API-клиент для работы с тестовыми платежами ЮKassa и подписками.
 *
 * Эндпоинты gateway:
 * - POST /payments/subscription — создать платёж за подписку (Pro/Max).
 * - GET /payments/{id}/status — узнать статус платежа (для поллинга).
 * - GET /subscription/plans — список доступных тарифов (Pro 999 ₽, Max 1999 ₽).
 * - GET /subscription/me — текущая подписка пользователя.
 *
 * Идиома использования: createSubscriptionPayment отдаёт confirmation_token,
 * который скармливается в YooMoneyCheckoutWidget. После успешной оплаты
 * webhook от ЮKassa апдейтит план на бэке; фронт параллельно поллит
 * getStatus раз в 2 секунды как fallback.
 */
export class PaymentApi {
    #http: HttpClient;

    /**
     * Берёт singleton HttpClient.
     */
    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    /**
     * Парсит JSON-ответ и проверяет ApiEnvelope.
     * @param response - объект Response
     * @returns распакованный body.data
     * @throws Error при HTTP не-2xx
     */
    async #parse<T>(response: Response): Promise<T> {
        const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
        if (!response.ok) {
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
        return body.data as T;
    }

    /**
     * Создаёт платёж в ЮKassa за выбранную подписку. Бэк регистрирует
     * платёж в БД и возвращает confirmation_token для рендера виджета.
     * POST /payments/subscription. Принимает канонические имена тарифов;
     * legacy-значения ('pro'/'max') бэкенд нормализует через
     * domain.NormalizePlan.
     * @param plan - имя плана ('developer' или 'professional')
     * @param returnURL - URL возврата после оплаты (для виджета)
     * @returns промис с параметрами созданного платежа
     */
    public async createSubscriptionPayment(
        plan: 'developer' | 'professional',
        returnURL?: string
    ): Promise<CreatePaymentResponse> {
        const response = await this.#http.post('/payments/subscription', {
            plan,
            return_url: returnURL
        });
        return this.#parse<CreatePaymentResponse>(response);
    }

    /**
     * Получает текущий статус платежа. Бэк сам сходит в ЮKassa если статус
     * ещё pending — это удобный поллинг. GET /payments/:id/status.
     * @param paymentID - внутренний UUID платежа
     * @returns промис со статусом и суммой
     */
    public async getPaymentStatus(paymentID: string): Promise<PaymentStatusResponse> {
        const response = await this.#http.get(`/payments/${paymentID}/status`, { noCache: true });
        return this.#parse<PaymentStatusResponse>(response);
    }

    /**
     * Загружает список доступных планов. GET /subscription/plans.
     * @returns промис со списком планов
     */
    public async listPlans(): Promise<PlanListResponse> {
        const response = await this.#http.get('/subscription/plans');
        return this.#parse<PlanListResponse>(response);
    }

    /**
     * Загружает текущую активную подписку пользователя. GET /subscription/me.
     * @returns промис с текущей подпиской (has_active=false если её нет)
     */
    public async getMySubscription(): Promise<MySubscriptionResponse> {
        const response = await this.#http.get('/subscription/me', { noCache: true });
        return this.#parse<MySubscriptionResponse>(response);
    }
}
