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

function codeToStyle(code: number): string | null {
    if (code === 1) return 'font-weight:bold';
    if (code === 3) return 'font-style:italic';
    if (code === 4) return 'text-decoration:underline';
    if (ANSI_COLORS[code]) return `color:${ANSI_COLORS[code]}`;
    return null;
}

const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

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
                if (style) {
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

export function stripTracebackDashes(text: string): string {
    return text.replace(/^-{10,}\s*$/gm, '').replace(/\n{3,}/g, '\n\n');
}

export function handleCarriageReturns(text: string): string {
    return text
        .split('\n')
        .map((line) => {
            const parts = line.split('\r');
            return parts[parts.length - 1];
        })
        .join('\n');
}
