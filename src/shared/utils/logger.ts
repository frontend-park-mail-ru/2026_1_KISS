/**
 * Централизованная точка логирования ошибок. Используется вместо прямых
 * `console.error` (правило `no-console` запрещает их в коде, исключение
 * для логгера сделано здесь одной точечной директивой).
 * @param message - сообщение об ошибке или контекст
 * @param error - объект ошибки (опционально)
 */
export function logError(message: unknown, error?: unknown): void {
    // eslint-disable-next-line no-console -- centralized error logging entry point
    console.error(message, error);
}
