export function logError(message: unknown, error?: unknown): void {
    // eslint-disable-next-line no-console -- centralized error logging entry point
    console.error(message, error);
}
