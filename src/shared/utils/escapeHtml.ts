const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/**
 * Экранирует символы HTML в строке для безопасной вставки в innerHTML.
 * Защита от XSS: заменяет `&`, `<`, `>`, `"`, `'` на соответствующие entity.
 * Не-строковые значения сериализуются через JSON.stringify; null/undefined → пустая строка.
 * @param str - произвольное значение (обычно ввод пользователя)
 * @returns безопасная для вставки в HTML строка
 */
export function escapeHtml(str: unknown): string {
    if (str === null || str === undefined) return '';
    const s = typeof str === 'string' ? str : JSON.stringify(str);
    return s.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}
