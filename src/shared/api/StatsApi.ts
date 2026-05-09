import { HttpClient } from '../http_client/HttpClient.js';
import type { ApiEnvelope } from './types.js';

/**
 * Статистика пользователя для страницы профиля: квота, активность,
 * ресурсы (notebook'и/блоки/выполнения), хранилище.
 */
export interface UserStats {
    /** Квота тарифного плана */
    quota: {
        /** Идентификатор плана ('free', 'pro', ...) */
        plan: string;
        /** Использованное время в секундах */
        total_time_seconds: number;
        /** Лимит времени по плану в секундах */
        time_limit_seconds: number;
        /** Использовано в процентах от лимита */
        usage_percent: number;
    };
    /** Активность пользователя */
    activity: {
        /** ISO-дата последней активности */
        last_active_at: string;
        /** ISO-дата создания аккаунта */
        created_at: string;
        /** Дневная активность за последние N дней (для графика) */
        daily_activity: { date: string; count: number }[];
    };
    /** Использование ресурсов */
    resources: {
        /** Количество notebook'ов */
        notebook_count: number;
        /** Суммарное количество блоков */
        block_count: number;
        /** Всего выполнений кода */
        total_executions: number;
        /** Дневные выполнения за последние N дней (для графика) */
        daily_executions: { date: string; count: number }[];
    };
    /** Использование хранилища */
    storage: {
        /** Количество файлов */
        total_files: number;
        /** Суммарный размер в байтах */
        total_size_bytes: number;
        /** Распределение количества по категориям ('avatar', 'feedback', ...) */
        files_by_category: Record<string, number>;
        /** Распределение размера по категориям */
        size_by_category: Record<string, number>;
    };
}

/**
 * API-клиент для статистики текущего пользователя.
 */
export class StatsApi {
    #http: HttpClient;

    /**
     * Берёт singleton HttpClient.
     */
    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    /**
     * Загружает статистику текущего пользователя. GET /users/me/stats.
     * Используется на странице профиля для отрисовки графиков и квот.
     * @returns промис со статистикой
     * @throws Error при HTTP не-2xx или пустом теле
     */
    public async getMyStats(): Promise<UserStats> {
        const response = await this.#http.get('/users/me/stats');
        const body = (await response.json()) as Partial<ApiEnvelope<UserStats>>;
        if (!response.ok) {
            throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        }
        if (!body.data) throw new Error('Empty response data');
        return body.data;
    }
}
