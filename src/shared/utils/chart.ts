/**
 * Локальный HTML-эскейп для безопасной вставки лейблов в SVG.
 * Дублирует логику из escapeHtml.ts, но через DOM API чтобы не тащить зависимость.
 * @param text - текст для эскейпа
 * @returns текст с экранированными HTML-символами
 */
function escapeHtml(text: string): string {
    const el = document.createElement('span');
    el.textContent = text;
    return el.innerHTML;
}

/**
 * Описание одной отметки на оси Y графика.
 */
interface YTick {
    /** Числовое значение отметки */
    value: number;
    /** Подпись отметки в UI */
    label: string;
}

/**
 * Подбирает разумный набор делений по оси Y для столбчатой диаграммы.
 * Для маленьких значений (≤5) генерирует целочисленные деления 0..maxVal,
 * для больших — 5 равномерных делений с округлённым шагом.
 * @param maxVal - максимальное значение в данных
 * @returns массив отметок для оси Y
 */
function calcYTicks(maxVal: number): YTick[] {
    if (maxVal <= 0) return [{ value: 0, label: '0' }];
    if (maxVal <= 5) {
        const ticks: YTick[] = [];
        for (let i = 0; i <= maxVal; i++) ticks.push({ value: i, label: String(i) });
        return ticks;
    }
    const step = Math.ceil(maxVal / 4);
    const ticks: YTick[] = [];
    for (let i = 0; i <= 4; i++) {
        const v = step * i;
        ticks.push({ value: Math.min(v, maxVal), label: String(Math.min(v, maxVal)) });
    }
    return ticks;
}

/**
 * Форматирует дату YYYY-MM-DD в короткую подпись с днём недели на русском.
 * Например, "2026-05-09" → "09.05(сб)".
 * @param raw - дата в ISO-формате YYYY-MM-DD
 * @returns короткая подпись для оси X
 */
function formatDateLabel(raw: string): string {
    const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const parts = raw.split('-');
    if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return `${parts[2]}.${parts[1]}(${DAYS[d.getDay()]})`;
    }
    return raw;
}

/**
 * Дополняет разреженные данные (только дни с активностью) полным окном
 * последних N дней, заполняя пропуски нулями. Нужно для корректного отображения
 * "пустых" дней на графике активности.
 * @param entries - имеющиеся точки {date, count}
 * @param count - желаемое количество дней в результате (включая сегодня)
 * @returns массив длины count, отсортированный от старых к новым
 */
export function fillDays(
    entries: { date: string; count: number }[],
    count: number
): { date: string; count: number }[] {
    const map = new Map<string, number>();
    entries.forEach((e) => map.set(e.date, e.count));
    const result: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, count: map.get(key) ?? 0 });
    }
    return result;
}

/**
 * Рендерит SVG столбчатой диаграммы по точкам {date, count}. Возвращает готовую
 * строку SVG для вставки в innerHTML. Размеры и палитра зашиты под фирменный
 * стиль (var(--teal-green) и т.п.). Под каждым столбцом — повёрнутый лейбл даты.
 * Используется на админских и пользовательских страницах статистики.
 * @param data - точки данных в порядке от старых к новым
 * @param cssClass - CSS-класс корневого контейнера (для скоупинга стилей)
 * @returns строка SVG-разметки
 */
export function renderBarChart(
    data: { date: string; count: number }[],
    cssClass = 'stats-chart'
): string {
    const maxVal = Math.max(...data.map((e) => e.count), 1);
    const width = 660;
    const height = 200;
    const padding = { left: 40, right: 10, top: 16, bottom: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const gap = 2;
    const barW = Math.max(3, Math.floor(chartW / data.length) - gap);
    const offsetX = padding.left;

    const ticks = calcYTicks(maxVal);

    let svg = `<svg viewBox="0 0 ${String(width)} ${String(height)}" class="${cssClass}__svg">`;
    svg += `<line x1="${String(padding.left)}" y1="${String(padding.top + chartH)}" x2="${String(padding.left + chartW)}" y2="${String(padding.top + chartH)}" stroke="var(--cell-border)" stroke-width="1"/>`;

    ticks.forEach(({ value, label }) => {
        const y = padding.top + chartH - (value / maxVal) * chartH;
        svg += `<text x="${String(padding.left - 6)}" y="${String(y + 4)}" text-anchor="end" font-size="10" fill="var(--accent)">${label}</text>`;
        if (value > 0)
            svg += `<line x1="${String(padding.left)}" y1="${String(y)}" x2="${String(padding.left + chartW)}" y2="${String(y)}" stroke="var(--light-grey)" stroke-width="1" stroke-dasharray="4,3"/>`;
    });

    const labelStep = Math.max(1, Math.ceil(data.length / 12));

    data.forEach((entry, i) => {
        const x = offsetX + i * (barW + gap);
        const val = entry.count;
        const barH = val > 0 ? Math.max(2, (val / maxVal) * chartH) : 0;
        const y = padding.top + chartH - barH;

        const opacity = val > 0 ? 1 : 0.15;
        svg += `<rect x="${String(x)}" y="${String(val > 0 ? y : padding.top + chartH - 2)}" width="${String(barW)}" height="${String(val > 0 ? barH : 2)}" fill="var(--teal-green)" opacity="${String(opacity)}" rx="1"><title>${escapeHtml(formatDateLabel(entry.date))}: ${String(val)}</title></rect>`;

        if (i % labelStep === 0) {
            const lbl = formatDateLabel(entry.date);
            const tx = x + barW / 2;
            const ty = padding.top + chartH + 10;
            svg += `<text x="${String(tx)}" y="${String(ty)}" text-anchor="end" font-size="9" fill="var(--accent)" transform="rotate(-45 ${String(tx)} ${String(ty)})">${escapeHtml(lbl)}</text>`;
        }
    });

    svg += '</svg>';
    return svg;
}
