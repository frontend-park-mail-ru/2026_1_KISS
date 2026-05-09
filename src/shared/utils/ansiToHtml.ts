import { escapeHtml } from './escapeHtml.js';

const ANSI_COLORS: Record<number, string> = {
    30: '#4E4E4E',
    31: '#E75C58',
    32: '#00A250',
    33: '#DDB62B',
    34: '#208FFB',
    35: '#D160C4',
    36: '#60C6C8',
    37: '#C5C1B4',
    90: '#7F7F7F',
    91: '#F2473F',
    92: '#00D26B',
    93: '#F5CF65',
    94: '#5FB2FF',
    95: '#E47FFD',
    96: '#76E3E8',
    97: '#F7F7F1'
};

/**
 * Преобразует числовой ANSI-код в CSS-стиль для span-обёртки.
 * Поддерживает bold (1), italic (3), underline (4) и стандартные foreground-цвета.
 * @param code - ANSI escape-код
 * @returns CSS-объявление или null если код неподдерживаемый
 */
function codeToStyle(code: number): string | null {
    if (code === 1) return 'font-weight:bold';
    if (code === 3) return 'font-style:italic';
    if (code === 4) return 'text-decoration:underline';
    if (ANSI_COLORS[code]) return `color:${ANSI_COLORS[code]}`;
    return null;
}

// eslint-disable-next-line no-control-regex -- ANSI escape sequences are control characters by definition
const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

/**
 * Конвертирует текст с ANSI escape-последовательностями (вывод Python/SSH/REPL)
 * в безопасный HTML с цветами и стилями. Все непосредственные символы экранируются
 * через escapeHtml; ANSI-коды превращаются в `<span style="...">` обёртки.
 * Корректно балансирует открытые span при ANSI reset (\\x1b[0m).
 * @param text - сырой текст с ANSI-кодами
 * @returns HTML-строка готовая для innerHTML
 */
export function ansiToHtml(text: string): string {
    ANSI_REGEX.lastIndex = 0;
    let result = '';
    let lastIndex = 0;
    let openSpans = 0;
    let match: RegExpExecArray | null;

    while ((match = ANSI_REGEX.exec(text)) !== null) {
        result += escapeHtml(text.slice(lastIndex, match.index));
        lastIndex = ANSI_REGEX.lastIndex;

        const codes = match[1].split(';').filter(Boolean).map(Number);

        for (const code of codes) {
            if (code === 0) {
                while (openSpans > 0) {
                    result += '</span>';
                    openSpans--;
                }
            } else {
                const style = codeToStyle(code);
                if (style !== null) {
                    result += `<span style="${style}">`;
                    openSpans++;
                }
            }
        }
    }

    result += escapeHtml(text.slice(lastIndex));
    while (openSpans > 0) {
        result += '</span>';
        openSpans--;
    }

    return result;
}

/**
 * Удаляет декоративные разделители из python traceback (длинные подчёркивания)
 * и схлопывает множественные пустые строки до двух. Косметика для вывода ошибок.
 * @param text - текст traceback
 * @returns очищенный текст
 */
export function stripTracebackDashes(text: string): string {
    return text.replace(/^-{10,}\s*$/gm, '').replace(/\n{3,}/g, '\n\n');
}

/**
 * Эмулирует поведение терминала с символами возврата каретки (\\r):
 * для каждой строки оставляет только содержимое после последнего \\r.
 * Нужно для корректного отображения прогресс-баров (tqdm и подобных).
 * @param text - текст возможно содержащий \\r
 * @returns текст без \\r, с правильно обрезанными строками
 */
export function handleCarriageReturns(text: string): string {
    return text
        .split('\n')
        .map((line) => {
            const parts = line.split('\r');
            return parts[parts.length - 1];
        })
        .join('\n');
}
