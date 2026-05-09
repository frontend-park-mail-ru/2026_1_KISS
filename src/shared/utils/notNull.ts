/**
 * Runtime-проверка на null/undefined: используется как замена TS-оператора `!`
 * (`@typescript-eslint/no-non-null-assertion` запрещён). Если значение нулевое —
 * бросает Error с указанным сообщением, иначе возвращает значение с типом NonNullable.
 * @param value - проверяемое значение
 * @param message - текст ошибки, если значение нулевое
 * @returns то же значение, типизированное как NonNullable
 * @throws Error если value === null или value === undefined
 */
export function nn<T>(value: T, message?: string): NonNullable<T> {
    if (value === null || value === undefined) {
        throw new Error(message ?? 'Expected non-null value');
    }
    return value;
}
