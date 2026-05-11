/**
 * Возвращает true, если HTTP-статус соответствует ошибке аутентификации
 * (401 Unauthorized) или авторизации (403 Forbidden). Именно при этих
 * статусах фронтенд имеет право принудительно отправлять пользователя
 * на /sign — других «легитимных» поводов для разлогина нет.
 * @param status - HTTP-статус из Response.status
 * @returns true для 401 и 403, иначе false
 */
export function isAuthError(status: number): boolean {
    return status === 401 || status === 403;
}

/**
 * Возвращает true, если HTTP-статус относится к семейству 5xx (Server Error).
 * Такие ответы означают сбой на стороне сервера, а не проблему с сессией,
 * поэтому реагировать на них разлогином пользователя нельзя.
 * @param status - HTTP-статус из Response.status
 * @returns true для 500..599, иначе false
 */
export function isServerError(status: number): boolean {
    return status >= 500 && status < 600;
}
