/**
 * DTO одного сообщения переписки. Возвращается бэкендом в массиве истории
 * и сохраняется в БД на стороне chat-сервиса. Соответствует
 * api/proto/chat/chat.proto ChatMessage.
 */
export interface ChatMessageDTO {
    /** Идентификатор сообщения в БД */
    id: number;
    /** Роль: 'user' / 'assistant' / 'system' */
    role: string;
    /** Текст сообщения */
    content: string;
    /** Имя модели, которой сгенерирован ответ (пусто для user-сообщений) */
    model?: string;
    /** Количество входных токенов (для assistant-сообщений) */
    tokens_in: number;
    /** Количество выходных токенов (для assistant-сообщений) */
    tokens_out: number;
    /** ID ноутбука, к которому привязано сообщение */
    notebook_id: number;
    /** Unix timestamp создания */
    created_at: number;
}

/**
 * Ответ на GET /chat/history — список сообщений в хронологическом порядке.
 */
export interface ChatHistoryResponse {
    /** Массив сообщений */
    messages: ChatMessageDTO[];
}

/**
 * Пользовательские настройки чата с ИИ: выбранная модель и системный промпт.
 */
export interface ChatSettingsDTO {
    /** Идентификатор выбранной модели */
    model: string;
    /** Системный промпт, подкладываемый перед каждым диалогом */
    system_prompt: string;
    /** Unix timestamp последнего изменения */
    updated_at: number;
}

/**
 * Запись использования по конкретной модели за всё время.
 */
export interface ChatUsageByModel {
    /** Имя модели */
    model: string;
    /** Количество запросов */
    requests: number;
    /** Общее количество токенов (вход + выход) */
    tokens: number;
}

/**
 * Ответ на GET /chat/usage — расход за сегодня и за всё время + лимиты тарифа.
 */
export interface ChatUsageResponse {
    /** Сколько запросов отправлено сегодня */
    requests_today: number;
    /** Сколько токенов потрачено сегодня */
    tokens_today: number;
    /** Суточный лимит запросов на текущем плане */
    daily_request_limit: number;
    /** Суточный лимит токенов на текущем плане */
    daily_token_limit: number;
    /** Общее число запросов за всё время */
    total_requests: number;
    /** Общее число токенов за всё время */
    total_tokens: number;
    /** Разбивка использования по моделям */
    by_model: ChatUsageByModel[];
}

/**
 * Описание одной модели — доступна или нет на текущем тарифе, и для каких
 * планов она открыта (для UI-подсказки «доступно в Pro»).
 */
export interface AiModelDTO {
    /** Идентификатор модели (например, openai/gpt-4o-mini) */
    id: string;
    /** Человекочитаемое имя для UI */
    label: string;
    /** Доступна ли модель на текущем тарифе пользователя */
    available: boolean;
    /** Минимальный план, на котором модель доступна ('free'|'pro'|'max') */
    required_plan?: string;
}

/**
 * Ответ на GET /chat/models — список всех известных моделей с пометкой
 * доступности для текущего пользователя.
 */
export interface AiModelsResponse {
    /** Массив моделей */
    models: AiModelDTO[];
}

/**
 * Опции контекста, которые фронт может приложить к сообщению чата:
 * содержимое выделенной ячейки и/или дамп всего ноутбука. Бэкенд встроит
 * их в подсказку для модели.
 */
export interface ChatContextOptions {
    /** ID выделенной ячейки (если есть) */
    cell_id?: number;
    /** Содержимое выделенной ячейки */
    cell_content?: string;
    /** Язык выделенной ячейки */
    cell_language?: string;
    /** Сериализованный дамп всего ноутбука */
    notebook_dump?: string;
    /** Признак: включать ли весь ноутбук в подсказку */
    include_notebook?: boolean;
}

/**
 * Тип сообщений, которые фронт шлёт в WS чат.
 */
export interface ChatWSOutgoing {
    /** Тип сообщения: 'message' для запроса, 'ping' для keepalive */
    type: 'message' | 'ping';
    /** ID ноутбука для привязки истории */
    notebook_id?: number;
    /** Текст пользовательского сообщения */
    content?: string;
    /** Выбранная модель (если пусто — серверная default-модель) */
    model?: string;
    /** Контекст диалога */
    context?: ChatContextOptions;
}

/**
 * Тип сообщений, которые сервер шлёт в WS чат.
 */
export interface ChatWSIncoming {
    /** Тип события: 'chunk', 'done', 'error', 'pong' */
    type: string;
    /** Кусок ответа модели (при type='chunk') */
    content?: string;
    /** Количество входных токенов (приходит с done) */
    tokens_in?: number;
    /** Количество выходных токенов (приходит с done) */
    tokens_out?: number;
    /** ID assistant-сообщения в БД (приходит с done) */
    message_id?: number;
    /** Машиночитаемый код ошибки (при type='error') */
    error_code?: string;
    /** Текст ошибки для отображения пользователю */
    error_message?: string;
}
