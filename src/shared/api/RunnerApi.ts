import { HttpClient } from '../http_client/HttpClient.js';
import { mapServerError } from '../utils/serverErrors.js';
import type { ApiEnvelope, ExecutionResultDTO } from './types.js';

/**
 * Один элемент массива detail в ошибке валидации FastAPI (Python runner).
 */
interface FastApiValidationDetail {
    /** Сообщение конкретной ошибки */
    msg?: string;
}

/**
 * Стандартная структура ошибки валидации Pydantic в FastAPI.
 * Используется чтобы извлечь читаемое сообщение из вложенного JSON.
 */
interface FastApiValidationError {
    /** Массив ошибок валидации */
    detail?: FastApiValidationDetail[];
}

/**
 * API-клиент для runner-сервиса (запуск кода в docker-контейнерах).
 * Бэкенд: cmd/runner (gRPC за gateway). Все эндпоинты под /api/v1/runner/*.
 *
 * Особенность: runner проксирует ошибки от внутреннего Python-сервиса
 * (FastAPI), которые приходят в формате Pydantic ValidationError —
 * #formatError извлекает читаемое сообщение из JSON в строке ошибки.
 */
export class RunnerApi {
    #http: HttpClient;

    /**
     * Берёт singleton HttpClient.
     */
    public constructor() {
        this.#http = HttpClient.getInstance();
    }

    /**
     * Парсит ответ, разворачивает FastAPI-ошибки валидации в человекочитаемый текст.
     * @param response - объект Response
     * @returns распакованный body.data
     * @throws Error с отформатированным сообщением при не-2xx
     */
    async #parse<T>(response: Response): Promise<T> {
        const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
        if (!response.ok) {
            const raw = body.error ?? '';
            const formatted = this.#formatError(raw);
            throw new Error(mapServerError(formatted, response.status));
        }
        return body.data as T;
    }

    /**
     * Извлекает читаемое сообщение из вложенного JSON FastAPI-ошибки.
     * Если в строке raw находит JSON-блок с полем detail (Pydantic) —
     * собирает все msg через '; '. Иначе возвращает raw как есть.
     * @param raw - сырой текст ошибки от runner
     * @returns читаемое сообщение для пользователя
     */
    #formatError(raw: string): string {
        const jsonMatch = /:\s*(\{.+\})\s*$/s.exec(raw);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]) as FastApiValidationError;
                if (Array.isArray(parsed.detail) && parsed.detail.length > 0) {
                    return parsed.detail
                        .map((d) => d.msg)
                        .filter(Boolean)
                        .join('; ');
                }
            } catch {
                /* fallback */
            }
        }
        return raw;
    }

    /**
     * Запускает один блок по идентификатору. Соответствует POST /runner/:nb/block.
     * Используется id (а не позиция), чтобы устранить race с pending reorder:
     * пока reorder не доехал до сервера, position может указывать не на тот блок.
     * @param notebookId - ID notebook'а
     * @param blockId - идентификатор запускаемого блока
     * @returns промис с результатом выполнения (stdout/stderr/result/outputs)
     */
    public async executeBlock(
        notebookId: number | string,
        blockId: number | string
    ): Promise<ExecutionResultDTO> {
        const response = await this.#http.post(
            `/runner/${String(notebookId)}/block?block_id=${String(blockId)}`
        );
        return this.#parse<ExecutionResultDTO>(response);
    }

    /**
     * Запускает все блоки начиная с позиции (Run all from here).
     * Соответствует POST /runner/:nb.
     * @param notebookId - ID notebook'а
     * @param startPosition - стартовая позиция (по умолчанию 0 — весь notebook)
     * @returns промис с массивом результатов в порядке выполнения
     */
    public async executeFromPosition(
        notebookId: number | string,
        startPosition = 0
    ): Promise<ExecutionResultDTO[]> {
        const response = await this.#http.post(
            `/runner/${String(notebookId)}?block_position=${String(startPosition)}`
        );
        return this.#parse<ExecutionResultDTO[]>(response);
    }

    /**
     * Останавливает сессию выполнения (убивает контейнер). Не бросает ошибки —
     * проглатывает все исключения, потому что вызывается в beforeunload/leave-навигации
     * где обрабатывать ошибки уже бессмысленно.
     * @param notebookId - ID notebook'а
     * @returns промис, всегда резолвится void
     */
    public stopSession(notebookId: number | string): Promise<void> {
        try {
            return this.#http.post(`/runner/${String(notebookId)}/stop`).then(
                () => undefined,
                () => undefined
            );
        } catch {
            return Promise.resolve();
        }
    }

    /**
     * Альтернативный stopSession через navigator.sendBeacon — подходит для
     * вызова в pagehide/visibilitychange, где обычный fetch может не успеть
     * до закрытия вкладки. Beacon гарантированно отправляется браузером.
     * @param notebookId - ID notebook'а
     */
    public stopSessionBeacon(notebookId: number | string): void {
        if (typeof navigator !== 'undefined') {
            navigator.sendBeacon(`/api/v1/runner/${String(notebookId)}/stop`);
        }
    }
}
