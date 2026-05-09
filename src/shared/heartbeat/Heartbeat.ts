import { EventApi } from '../api/EventApi.js';

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Singleton-сервис heartbeat'а: регулярно (раз в минуту) отправляет событие
 * 'heartbeat' в EventApi для подсчёта DAU и измерения активного времени.
 *
 * При beforeunload отправляет финальный heartbeat через navigator.sendBeacon —
 * обычный fetch может не успеть до закрытия вкладки, beacon гарантирован.
 *
 * Запускается из bootstrap (src/app/index.ts) только для авторизованных
 * пользователей — на гостевых страницах не нужен.
 */
export class Heartbeat {
    static #instance: Heartbeat | null = null;
    #intervalId: ReturnType<typeof setInterval> | null = null;
    #eventApi!: EventApi;

    /**
     * Создаёт сервис и инстанцирует EventApi для отправки. Прямой вызов
     * допустим, но предпочтителен getInstance() для singleton-семантики.
     */
    public constructor() {
        this.#eventApi = new EventApi();
    }

    /**
     * Возвращает singleton-экземпляр; создаёт при первом обращении.
     * @returns единственный экземпляр Heartbeat
     */
    public static getInstance(): Heartbeat {
        Heartbeat.#instance ??= new Heartbeat();
        return Heartbeat.#instance;
    }

    /**
     * Запускает периодическую отправку heartbeat'ов и подписывается на beforeunload.
     * Идемпотентен — повторный вызов при активном таймере ничего не делает.
     */
    public start(): void {
        if (this.#intervalId !== null) {
            return;
        }
        this.#send();
        this.#intervalId = setInterval(() => {
            this.#send();
        }, HEARTBEAT_INTERVAL_MS);

        window.addEventListener('beforeunload', this.#onUnload);
    }

    /**
     * Останавливает таймер и снимает обработчик beforeunload. Вызывается при
     * logout'е чтобы прекратить трекинг.
     */
    public stop(): void {
        if ((this.#intervalId ?? 0) !== 0) {
            clearInterval(this.#intervalId);
            this.#intervalId = null;
        }
        window.removeEventListener('beforeunload', this.#onUnload);
    }

    /**
     * Отправляет один heartbeat через EventApi. Ошибки игнорируются —
     * heartbeat best-effort, не должен ломать UX из-за временной недоступности.
     */
    #send(): void {
        this.#eventApi.trackEvent('heartbeat').catch(() => {
            /* noop */
        });
    }

    /**
     * Финальный heartbeat при закрытии вкладки через sendBeacon. Стрелочная
     * функция (не метод) чтобы сохранить ссылку для removeEventListener.
     */
    #onUnload = (): void => {
        if (typeof navigator !== 'undefined') {
            const body = JSON.stringify({ event_type: 'heartbeat', metadata: '{}' });
            navigator.sendBeacon(
                '/api/v1/events/track',
                new Blob([body], { type: 'application/json' })
            );
        }
    };
}
