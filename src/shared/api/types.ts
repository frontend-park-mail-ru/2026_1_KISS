/**
 * Универсальный envelope ответов API: все эндпоинты Go-бэкенда возвращают
 * `{ data: <payload>, error?: string }`. Используется как `ApiEnvelope<UserDTO>`,
 * `ApiEnvelope<NotebookListResponse>` и т.д.
 *
 * Соглашение: при response.ok можно безопасно читать data; иначе error содержит
 * серверный код ошибки (для translateError).
 */
export interface ApiEnvelope<T> {
    /** Полезная нагрузка ответа */
    data: T;
    /** Серверный код ошибки (только при не-2xx) */
    error?: string;
}

// ===== User / Auth =====

/**
 * DTO пользователя — полная серверная модель. snake_case полей сохранён как в
 * Go-бэкенде (auth/user). Соответствует api/proto/auth/auth.proto User message.
 */
export interface UserDTO {
    /** ID пользователя на сервере */
    id: number;
    /** Логин (уникален) */
    username: string;
    /** Email (уникален) */
    email: string;
    /** URL аватара (или дефолтная заглушка если не загружен) */
    avatar_url: string;
    /** Статус-строка (видна другим пользователям) */
    status: string;
    /** Описание профиля */
    description: string;
    /** Подтверждён ли email */
    is_verified: boolean;
    /** Имеет ли права администратора (доступ к /admin) */
    is_admin: boolean;
    /** Тарифный план ('free', 'pro', ...) */
    plan: string;
    /** Суммарное время активности в секундах (для статистики) */
    total_time_seconds: number;
    /** ISO-дата последней активности (опционально) */
    last_active_at?: string;
    /** ISO-дата создания аккаунта */
    created_at: string;
    /** ISO-дата последнего обновления */
    updated_at: string;
}

// ===== Notebook =====

/**
 * DTO одного output'а блока (stdout/stderr/result/image).
 */
export interface BlockOutputDTO {
    /** Тип: 'stdout', 'stderr', 'result', 'image/png', ... */
    output_type: string;
    /** Содержимое (текст или base64 для бинарных) */
    content: string;
    /** Позиция в массиве outputs (для упорядочивания при streaming) */
    position: number;
}

/**
 * DTO блока notebook'а. type определяет тип ('code'/'text'); language имеет
 * смысл только для code (на бэке всегда 'python' пока что).
 */
export interface BlockDTO {
    /** ID блока */
    id: number;
    /** Тип блока: 'code' или 'text' */
    type: string;
    /** Язык программирования для code-блоков */
    language: string;
    /** Содержимое */
    content: string;
    /** Позиция в notebook'е (порядок) */
    position: number;
    /** Outputs последнего выполнения (опционально) */
    outputs?: BlockOutputDTO[];
    /** ISO-дата создания */
    created_at: string;
    /** Номер последнего выполнения (Jupyter execution count) */
    execution_count?: number;
}

/**
 * DTO notebook'а. owner_username приходит когда notebook расшарен текущему
 * пользователю другим — для отображения "владельца" в files-table.
 */
export interface NotebookDTO {
    /** ID notebook'а */
    id: number;
    /** ID владельца */
    owner_id: number;
    /** Логин владельца (для расшаренных notebook'ов) */
    owner_username?: string;
    /** Заголовок */
    title: string;
    /** true если notebook доступен по прямой ссылке без авторизации */
    is_public: boolean;
    /** Блоки notebook'а (опционально, в list-эндпоинте обычно не приходят) */
    blocks?: BlockDTO[];
    /** ISO-дата создания */
    created_at: string;
    /** ISO-дата последнего обновления */
    updated_at: string;
}

/**
 * Ответ листинга notebook'ов с пагинацией.
 */
export interface NotebookListResponse {
    /** Найденные notebook'и (страница) */
    notebooks: NotebookDTO[];
    /** Общее количество (для пагинации) */
    total: number;
    /** Размер страницы */
    limit: number;
    /** Смещение страницы */
    offset: number;
}

// ===== Permissions =====

/**
 * DTO одного разрешения: notebook_id + user_id + уровень доступа.
 * Используется в ShareModal для управления доступами.
 */
export interface PermissionDTO {
    /** ID notebook'а на который выдано право */
    notebook_id: number;
    /** ID пользователя получившего доступ */
    user_id: number;
    /** Уровень: 'read' / 'write' */
    permission_level: string;
    /** Email пользователя (для отображения в UI) */
    email?: string;
}

/**
 * Ответ листинга разрешений для одного notebook'а.
 */
export interface PermissionListResponse {
    /** Список выданных разрешений */
    permissions: PermissionDTO[];
}

// ===== Comments =====

/**
 * DTO комментария к блоку.
 */
export interface CommentDTO {
    /** ID комментария */
    id: number;
    /** ID автора */
    user_id: number;
    /** Логин автора (для отображения) */
    username: string;
    /** ID блока к которому привязан */
    block_id: number;
    /** Текст комментария */
    text: string;
    /** ISO-дата создания */
    created_at: string;
}

// ===== Issues =====

/**
 * DTO одного сообщения в треде issue (запрос в поддержку).
 */
export interface IssueMessageDTO {
    /** ID сообщения */
    id: number;
    /** ID issue к которому относится */
    issue_id: number;
    /** ID автора */
    user_id: number;
    /** Логин автора (опционально, может не приходить) */
    username?: string;
    /** true если автор — администратор (для бейджа в UI) */
    is_admin: boolean;
    /** Текст сообщения */
    content: string;
    /** ISO-дата создания */
    created_at: string;
}

/**
 * DTO issue (тикета в поддержку или фидбека).
 */
export interface IssueDTO {
    /** ID issue */
    id: number;
    /** ID автора */
    user_id: number;
    /** Логин автора */
    username?: string;
    /** Категория ('bug', 'feature', 'support', ...) */
    category: string;
    /** Статус ('open', 'in_progress', 'closed') */
    status: string;
    /** Первоначальный текст */
    content: string;
    /** Тред переписки */
    messages: IssueMessageDTO[];
    /** Прикреплённые файлы */
    attachments?: IssueAttachmentDTO[];
    /** ISO-дата создания */
    created_at: string;
    /** ISO-дата последнего обновления */
    updated_at: string;
}

/**
 * DTO одного прикреплённого файла к issue.
 */
export interface IssueAttachmentDTO {
    /** ID файла в storage-сервисе */
    id: number;
    /** Имя файла как загрузил пользователь */
    filename: string;
    /** MIME-тип */
    mime_type: string;
    /** Размер в байтах */
    size: number;
}

/**
 * Ответ листинга issues с пагинацией.
 */
export interface IssueListResponse {
    /** Найденные issues (страница) */
    issues: IssueDTO[];
    /** Общее количество */
    total: number;
    /** Размер страницы */
    limit: number;
    /** Смещение страницы */
    offset: number;
}

/**
 * Ответ статистики issues (агрегаты для админ-панели).
 */
export interface IssueStatsResponse {
    /** Всего issues */
    total: number;
    /** Открытых */
    open: number;
    /** В работе */
    in_progress: number;
    /** Закрытых */
    closed: number;
    /** Распределение по категориям */
    by_category: Record<string, number>;
}

// ===== Runner =====

/**
 * DTO одного output-элемента результата выполнения (изображение и т.п.).
 */
export interface OutputItemDTO {
    /** MIME-тип ('image/png', 'image/jpeg', ...) */
    mime_type: string;
    /** Содержимое (base64 для бинарных) */
    data: string;
}

/**
 * DTO результата выполнения одного блока в runner-сервисе.
 */
export interface ExecutionResultDTO {
    /** ID выполненного блока */
    block_id: number;
    /** Позиция в notebook'е */
    position: number;
    /** Строки stdout */
    stdout: string[];
    /** Строки stderr */
    stderr: string[];
    /** Строка возвращаемого значения */
    result: string;
    /** Бинарные outputs (изображения и т.п.) */
    outputs: OutputItemDTO[];
    /** Текст ошибки выполнения */
    error: string;
    /** ISO-дата выполнения */
    executed_at: string;
    /** Длительность выполнения (например '125ms') */
    duration: string;
}

/**
 * DTO статистики docker-контейнера пользователя (для resource-banner).
 */
export interface ContainerStatsDTO {
    /** Использование CPU в процентах */
    cpu_percent: number;
    /** Использование памяти в байтах */
    memory_usage: number;
    /** Лимит памяти в байтах */
    memory_limit: number;
    /** Использование памяти в процентах */
    memory_percent: number;
    /** Доступное количество ядер CPU */
    cpu_cores: number;
    /** Лимит дискового пространства в байтах */
    disk_limit_bytes: number;
    /** Доступен ли GPU для выполнения */
    gpu_available: boolean;
}

// ===== Admin =====

/**
 * Ответ листинга пользователей в админке.
 */
export interface AdminUserListResponse {
    /** Найденные пользователи */
    users: UserDTO[];
    /** Общее количество */
    total: number;
}

/**
 * Урезанная DTO notebook'а для админ-листинга (без блоков).
 */
export interface AdminNotebookSummaryDTO {
    /** ID notebook'а */
    id: number;
    /** ID владельца */
    owner_id: number;
    /** Заголовок */
    title: string;
    /** true если публичный */
    is_public: boolean;
    /** ISO-дата создания */
    created_at: string;
    /** ISO-дата последнего обновления */
    updated_at: string;
}

/**
 * Ответ листинга notebook'ов в админке.
 */
export interface AdminNotebookListResponse {
    /** Найденные notebook'и */
    notebooks: AdminNotebookSummaryDTO[];
    /** Общее количество */
    total: number;
}

/**
 * Ответ агрегированной статистики для админ-дашборда.
 */
export interface AdminStatsResponse {
    /** Всего пользователей */
    total_users: number;
    /** Всего активных сессий */
    total_sessions: number;
    /** Daily active users */
    dau: number;
    /** Monthly active users */
    mau: number;
    /** Всего notebook'ов */
    total_notebooks: number;
}

/**
 * Одна точка временного ряда DAU (для графика).
 */
export interface AdminActivityPoint {
    /** ISO-дата (YYYY-MM-DD) */
    date: string;
    /** Количество активных пользователей в этот день */
    count: number;
}

/**
 * Одна точка временного ряда MAU (для графика).
 */
export interface AdminMonthlyPoint {
    /** Месяц в формате YYYY-MM */
    month: string;
    /** Количество активных пользователей в этом месяце */
    count: number;
}

/**
 * Ответ статистики активности (DAU + MAU).
 */
export interface AdminActivityStatsResponse {
    /** Точки DAU за последние N дней */
    dau: AdminActivityPoint[];
    /** Точки MAU за последние N месяцев */
    mau: AdminMonthlyPoint[];
}

// ===== Payments / Subscriptions =====

/**
 * DTO одного тарифного плана подписки. Возвращается /subscription/plans.
 * Цена хранится в копейках (целые числа) для точности.
 */
export interface PlanDTO {
    /** ID плана в БД */
    id: number;
    /** Название (служебный идентификатор: 'pro' / 'max') */
    name: string;
    /** Цена в копейках (например 99900 = 999 ₽) */
    price_kopeks: number;
    /** Лимит запусков кода на период подписки */
    execution_quota: number;
    /** Длительность подписки в днях */
    duration_days: number;
}

/**
 * Ответ /subscription/plans — список доступных планов.
 */
export interface PlanListResponse {
    /** Найденные планы */
    plans: PlanDTO[];
}

/**
 * Ответ /payments/subscription — параметры созданного платежа.
 * confirmation_token нужен для рендера ЮKassa Checkout-виджета на клиенте.
 */
export interface CreatePaymentResponse {
    /** Внутренний ID платежа (UUID) для последующего поллинга статуса */
    payment_id: string;
    /** Одноразовый токен для конструктора YooMoneyCheckoutWidget */
    confirmation_token: string;
    /** Сумма списания в копейках (для UI-отображения) */
    amount_kopeks: number;
    /** Имя плана ('pro' / 'max') для UI-отображения */
    plan: string;
}

/**
 * Ответ /payments/{id}/status — текущий статус платежа.
 * status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'.
 */
export interface PaymentStatusResponse {
    /** Внутренний ID платежа */
    payment_id: string;
    /** Текущий статус */
    status: string;
    /** Сумма платежа в копейках */
    amount_kopeks: number;
    /** UNIX-таймстамп создания платежа */
    created_at: number;
    /** UNIX-таймстамп успешной оплаты (0 если ещё не оплачен) */
    paid_at: number;
}

/**
 * Ответ /subscription/me — текущая активная подписка пользователя.
 * Если has_active=false, started_at/expires_at отсутствуют.
 */
export interface MySubscriptionResponse {
    /** true если у пользователя есть непросроченная подписка */
    has_active: boolean;
    /** Текущий план (из user.plan, заполняется всегда) */
    plan: string;
    /** UNIX-таймстамп начала подписки */
    started_at?: number;
    /** UNIX-таймстамп окончания подписки */
    expires_at?: number;
}

// ===== WebSocket events =====

/**
 * Типы WebSocket-событий о изменениях notebook'а в real-time (collaborative editing).
 */
export type NotebookEventType =
    | 'block_added'
    | 'block_updated'
    | 'block_deleted'
    | 'notebook_updated'
    | 'comment_added'
    | 'comment_deleted';

/**
 * DTO одного WebSocket-события. Поля зависят от type — например для
 * 'block_added' будет block, для 'block_deleted' — deleted_block_id.
 */
export interface NotebookEventDTO {
    /** Тип события (см. NotebookEventType) */
    type: string;
    /** ID notebook'а */
    notebook_id?: number;
    /** ID пользователя инициировавшего событие */
    actor_id?: number;
    /** Полный блок (для added/updated) */
    block?: BlockDTO;
    /** ID блока (для частичных событий) */
    block_id?: number | string;
    /** ID удалённого блока (для block_deleted) */
    deleted_block_id?: number;
    /** Полный комментарий (для comment_added) */
    comment?: CommentDTO;
    /** ID комментария (для частичных событий) */
    comment_id?: number | string;
    /** ID удалённого комментария (для comment_deleted) */
    deleted_comment_id?: number;
    /** UNIX-таймстамп события */
    timestamp?: number;
    /** Произвольное сообщение (например для 'error') */
    message?: string;
}

// ===== Storage / Files =====

/**
 * DTO одного файла из storage-сервиса. Соответствует ответу
 * /api/v1/files/* и AdminFile в админ-листинге (за исключением owner_username).
 */
export interface FileItemDTO {
    /** UUID файла */
    id: string;
    /** ID владельца */
    owner_id: number;
    /** ID notebook'а (если файл прикреплён к notebook) */
    notebook_id?: number;
    /** Категория ('files', 'avatars', 'feedback', 'datasets') */
    category: string;
    /** Имя файла как ввёл пользователь */
    filename: string;
    /** Путь для скачивания (например /uploads/files/uuid.ext) */
    url: string;
    /** MIME-тип определённый по содержимому */
    mime_type: string;
    /** Размер в байтах */
    size: number;
    /** ISO-дата создания */
    created_at: string;
    /** Файл опубликован публичной ссылкой */
    is_public: boolean;
    /** UUID public-токена, если файл опубликован */
    share_token?: string | null;
    /** ISO-дата истечения public-ссылки */
    share_expires_at?: string | null;
    /** Количество скачиваний (всех каналов) */
    downloads_count: number;
    /** Уровень доступа текущего пользователя: owner/view/download/public */
    your_permission?: string;
    /** Авторизованный URL для скачивания */
    download_url: string;
    /** Публичный URL для скачивания (если is_public) */
    public_url?: string | null;
}

/**
 * DTO записи о расшаривании файла конкретному пользователю.
 */
export interface FileShareDTO {
    /** UUID файла */
    file_id: string;
    /** ID пользователя, которому выдан доступ */
    user_id: number;
    /** Email приглашённого (заполняется на бэке) */
    email?: string;
    /** Уровень доступа: 'view' или 'download' */
    permission_level: 'view' | 'download';
    /** ISO-дата выдачи доступа */
    created_at: string;
}

/**
 * Ответ /api/v1/files/:id/shares — список приглашений к файлу.
 */
export interface FileShareListResponse {
    /** Приглашения */
    shares: FileShareDTO[];
}

/**
 * Ответ /api/v1/files со списком файлов и общим числом для пагинации.
 */
export interface FileListResponse {
    /** Найденные файлы (страница) */
    files: FileItemDTO[];
    /** Общее количество */
    total: number;
}

/**
 * Ответ /api/v1/files/usage с информацией о квоте текущего пользователя.
 */
export interface FileUsageResponse {
    /** Использовано байт */
    used: number;
    /** Лимит байт (для admin берётся служебное большое число) */
    limit: number;
    /** true если у пользователя безлимитная квота (admin) */
    unlimited: boolean;
    /** Тариф пользователя ('free', 'pro', 'max', 'admin', 'freeze') */
    plan: string;
    /** Количество файлов пользователя */
    files_count: number;
}

// ===== Streaming (websocket runtime errors / output chunks) =====

/**
 * DTO события стриминга output'а во время выполнения блока (приходит по WS
 * порциями, чтобы пользователь видел print() сразу, а не в конце).
 */
export interface StreamChunkEvent {
    /** Тип чанка */
    type: 'stdout_chunk' | 'stderr_chunk' | 'execute_error' | 'error';
    /** ID выполняющегося блока */
    block_id?: number;
    /** Текст чанка или сообщение об ошибке */
    message?: string;
}
