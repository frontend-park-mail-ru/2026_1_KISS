const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

export function escapeHtml(str: unknown): string {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}
