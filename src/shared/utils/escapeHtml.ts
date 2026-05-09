const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

export function escapeHtml(str: unknown): string {
    if (str === null || str === undefined) return '';
    const s = typeof str === 'string' ? str : JSON.stringify(str);
    return s.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}
