export function logError(message: string, error?: unknown): void {
    // eslint-disable-next-line no-console -- centralized error logging entry point
    console.error(message, error);
}
