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
    'invalid token': 'Ссылка подтверждения недействительна или устарела. Зарегистрируйтесь ещё раз.',
    invalid_state: 'Сессия OAuth-входа устарела. Повторите вход.',
    email_taken: 'Этот email уже используется неподтверждённым аккаунтом. Войдите паролем и подтвердите его, либо используйте другую почту.',
    denied: 'Доступ через провайдера отклонён.',
    invalid_request: 'Некорректный ответ OAuth-провайдера. Попробуйте ещё раз.',
    unknown_provider: 'Этот OAuth-провайдер не поддерживается.',
    internal: 'Внутренняя ошибка OAuth-входа. Попробуйте позже.'
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
