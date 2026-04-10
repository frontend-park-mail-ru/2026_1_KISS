/**
 * НИКАКИЕ БИБЛИОТЕКИ НЕЛЬЗЯ ПОДКЛЮЧАТЬ / DO NOT ADD ANY LIBRARIES
 *
 * Замена DOMPurify для template literals.
 * Экранирует HTML-спецсимволы чтобы предотвратить XSS при вставке через innerHTML.
 * Для textContent экранирование не нужно -- браузер не парсит HTML в textContent.
 */

const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/**
 * @param {*} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}
