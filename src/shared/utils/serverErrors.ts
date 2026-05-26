const ERROR_MAP: Record<string, string> = {
    'invalid request body': 'Некорректные данные',
    'email or username already exists': 'Email или имя пользователя уже заняты',
    'invalid credentials': 'Неверный email или пароль',
    'internal server error': 'Ошибка сервера, попробуйте позже',
    'invalid input: invalid email format': 'Почта введена некорректно',
    'invalid input: file too large': 'Файл слишком большой (максимум 5 МБ)',
    'invalid input: invalid file type': 'Неподдерживаемый формат файла',
    'invalid input: status must not exceed 100 characters':
        'Статус не должен превышать 100 символов',
    'invalid input: description must not exceed 500 characters':
        'Описание не должно превышать 500 символов',
    'invalid input: password must be at least 8 characters':
        'Пароль должен быть не менее 8 символов',
    'invalid input: email is the same as current': 'Вы уже используете этот email',
    invalid_token: 'Ссылка подтверждения недействительна или устарела. Зарегистрируйтесь ещё раз.',
    'invalid token':
        'Ссылка подтверждения недействительна или устарела. Зарегистрируйтесь ещё раз.',
    invalid_state: 'Сессия OAuth-входа устарела. Повторите вход.',
    email_taken:
        'Этот email уже используется неподтверждённым аккаунтом. Войдите паролем и подтвердите его, либо используйте другую почту.',
    denied: 'Доступ через провайдера отклонён.',
    invalid_request: 'Некорректный ответ OAuth-провайдера. Попробуйте ещё раз.',
    unknown_provider: 'Этот OAuth-провайдер не поддерживается.',
    internal: 'Внутренняя ошибка OAuth-входа. Попробуйте позже.',
    'invalid input': 'Ссылка для сброса пароля недействительна или истекла.',
    'service unavailable': 'Сервис временно недоступен. Попробуйте через минуту.',
    'runner service unavailable':
        'Сервис выполнения кода временно недоступен. Попробуйте через минуту.',
    'disk full':
        'Закончилось место на диске. Освободите файлы в разделе «Мои файлы» или повысьте тариф.',
    'container out of memory':
        'Контейнеру не хватило памяти. Уменьшите объём данных или повысьте тариф.',
    'container cpu limit exceeded': 'Превышен лимит CPU. Оптимизируйте код или повысьте тариф.',
    'execution timeout':
        'Код выполнялся слишком долго и был остановлен. Разбейте его на меньшие шаги или повысьте тариф.'
};

/**
 * HTTP-статусы, для которых есть осмысленный fallback-текст когда серверная
 * строка ошибки не совпала ни с одной записью в ERROR_MAP. Используется когда
 * сервер вернул нестандартный текст, но статус достаточно информативен сам по себе.
 */
const STATUS_FALLBACKS: Record<number, string> = {
    503: 'Сервис временно недоступен. Попробуйте через минуту.',
    504: 'Код выполнялся слишком долго и был остановлен.',
    507: 'Закончилось место на диске. Освободите файлы или повысьте тариф.'
};

/**
 * Преобразует серверный код ошибки (английский, как возвращает Go-бэкенд)
 * в человекочитаемое сообщение на русском для показа пользователю.
 * Для незарегистрированных кодов возвращает универсальный fallback.
 * @param error - строка ошибки от сервера
 * @returns локализованное сообщение для UI
 */
export function translateError(error: string): string {
    return ERROR_MAP[error] ?? 'Произошла ошибка, попробуйте позже';
}

/**
 * Расширенный маппинг: сначала пытается сопоставить точную строку ошибки,
 * затем пробует подстроку (для wrapped-ошибок вида "disk full: create container ...").
 * Если ни одно совпадение не найдено — использует fallback по HTTP-статусу,
 * иначе возвращает универсальный текст.
 * @param error - строка ошибки от сервера (может быть пустой)
 * @param status - HTTP-статус ответа (для fallback'а 503/504/507)
 * @returns локализованное сообщение для UI
 */
export function mapServerError(error: string, status?: number): string {
    if (error.length > 0) {
        if (error in ERROR_MAP) return ERROR_MAP[error];
        const lowered = error.toLowerCase();
        for (const key of Object.keys(ERROR_MAP)) {
            if (lowered.includes(key)) return ERROR_MAP[key];
        }
    }
    if (status !== undefined && status in STATUS_FALLBACKS) {
        return STATUS_FALLBACKS[status];
    }
    return 'Произошла ошибка, попробуйте позже';
}
