/**
 * Форматирует размер в байтах в человеко-читаемую строку: 'B' / 'KB' / 'MB' / 'GB'.
 * Используется в виджетах disk-table, disk-usage-card и админ-секции файлов.
 * @param bytes - количество байт (целое неотрицательное число)
 * @param precision - количество знаков после запятой (по умолчанию 1)
 * @returns форматированная строка (например '12.3 MB')
 */
export function formatBytes(bytes: number, precision = 1): string {
    if (bytes < 0 || !Number.isFinite(bytes)) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    if (unitIndex === 0) {
        return `${String(value)} ${units[unitIndex]}`;
    }
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
