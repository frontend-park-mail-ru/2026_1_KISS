export function nn<T>(value: T, message?: string): NonNullable<T> {
    if (value === null || value === undefined) {
        throw new Error(message ?? 'Expected non-null value');
    }
    return value;
}
