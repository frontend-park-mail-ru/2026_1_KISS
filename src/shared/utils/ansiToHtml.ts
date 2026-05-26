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
 * Парсит начало CSI-последовательности (\x1b[...) на месте `start` в тексте.
 * Возвращает финальный байт, параметр-строку и индекс позиции сразу после
 * последовательности. Если последовательность некорректна — возвращает null.
 * @param text - исходный текст
 * @param start - индекс символа `\x1b` (предполагается что text[start+1] === `[`)
 * @returns разобранная последовательность или null
 */
function parseCSI(
    text: string,
    start: number
): { finalByte: string; param: string; next: number } | null {
    let j = start + 2;
    const paramStart = j;
    if (text[j] === '?') j++;
    while (j < text.length && /[0-9;]/.test(text[j] ?? '')) j++;
    if (j >= text.length) return null;
    return { finalByte: text[j], param: text.slice(paramStart, j), next: j + 1 };
}

/**
 * Применяет одну CSI-последовательность к буферу строк. Поддерживает:
 * SGR (m) — добавляется в текущую строку как есть для ansiToHtml;
 * cursor up/down (A/B) — двигает курсор по lines;
 * erase line (K) — очищает текущую строку;
 * erase display (J) — обрезает буфер до курсора. Прочие коды игнорирует.
 * @param lines - буфер строк (мутируется)
 * @param cursor - текущий индекс строки
 * @param rawSeq - сырая CSI-последовательность для случая SGR
 * @param csi - результат parseCSI
 * @returns новый индекс курсора
 */
function applyCSI(
    lines: string[],
    cursor: number,
    rawSeq: string,
    csi: { finalByte: string; param: string }
): number {
    const { finalByte, param } = csi;
    if (finalByte === 'm') {
        lines[cursor] += rawSeq;
        return cursor;
    }
    if (finalByte === 'A' || finalByte === 'B') {
        const parsed = parseInt(param, 10);
        const n = Number.isNaN(parsed) || parsed === 0 ? 1 : parsed;
        if (finalByte === 'A') return Math.max(0, cursor - n);
        const next = cursor + n;
        while (next >= lines.length) lines.push('');
        return next;
    }
    if (finalByte === 'K') {
        lines[cursor] = '';
    } else if (finalByte === 'J') {
        lines.length = cursor + 1;
        lines[cursor] = '';
    }
    return cursor;
}

/**
 * Эмулирует терминальный буфер: обрабатывает CSI-последовательности курсора
 * (cursor up/down, erase line/display), `\r` (возврат каретки) и `\n` (новая строка).
 * SGR-коды (цвет/стиль) сохраняются в выводе как есть для последующей передачи в ansiToHtml.
 * Прочие управляющие последовательности (например `\x1b[?25l` скрытия курсора) удаляются.
 * Нужно для корректного отображения прогресс-баров pip/tqdm, перерисовывающих строки.
 * @param text - сырой stdout/stderr с управляющими последовательностями
 * @returns многострочный текст без курсорных управляющих последовательностей, со сжатыми перерисовками
 */
export function normalizeTerminalControl(text: string): string {
    const lines: string[] = [''];
    let cursor = 0;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '\n') {
            cursor++;
            if (cursor >= lines.length) lines.push('');
            i++;
        } else if (ch === '\r') {
            lines[cursor] = '';
            i++;
        } else if (ch === '\x1b' && text[i + 1] === '[') {
            const csi = parseCSI(text, i);
            if (csi === null) {
                i++;
            } else {
                cursor = applyCSI(lines, cursor, text.slice(i, csi.next), csi);
                i = csi.next;
            }
        } else {
            lines[cursor] += ch;
            i++;
        }
    }
    return lines.join('\n');
}
