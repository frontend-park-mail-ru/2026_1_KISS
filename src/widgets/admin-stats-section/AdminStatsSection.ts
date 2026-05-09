import { AdminApi } from '../../shared/api/AdminApi.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { logError } from '../../shared/utils/logger.js';

/**
 * Одна tick-метка по оси Y графика.
 */
interface YTick {
    /** Числовое значение */
    value: number;
    /** Подпись для отрисовки */
    label: string;
}

/**
 * Одна точка timeseries по дням.
 */
interface DayPoint {
    /** Дата в ISO-формате YYYY-MM-DD */
    date: string;
    /** Количество событий в эту дату */
    count: number;
}

/**
 * Одна точка timeseries по месяцам.
 */
interface MonthPoint {
    /** Месяц в формате YYYY-MM */
    month: string;
    /** Количество событий в этом месяце */
    count: number;
}

const CHART_DAYS_RANGE = 30;
const CHART_MONTHS_RANGE = 12;
const DAYS_OF_WEEK = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/**
 * Виджет секции "Статистика" в админке. Полностью самодостаточен: владеет
 * собственным AdminApi-клиентом, рендерит KPI-карточки (4 для платформы +
 * 4 для обращений), два timeseries-графика (DAU за 30 дней, MAU за 12
 * месяцев) и категориальную диаграмму обращений.
 *
 * Заменяет ~270 строк методов в AdminPage (#renderStats + 5 chart-helper'ов).
 *
 * Жизненный цикл: построить через `new AdminStatsSection(parent)` → вызвать
 * `mount()`. Виджет сам сделает запросы к серверу и отрендерит содержимое.
 * Для очистки — `unmount()` (просто очищает DOM).
 */
export class AdminStatsSection {
    #parent: HTMLElement;
    #api: AdminApi;

    /**
     * Сохраняет родительский элемент и инициализирует AdminApi.
     * Сам по себе ничего не рендерит — нужно вызвать mount().
     * @param parent - элемент, в который будет вставлен контент секции
     */
    public constructor(parent: HTMLElement) {
        this.#parent = parent;
        this.#api = new AdminApi();
    }

    /**
     * Рендерит секцию: заголовок, KPI-карточки, графики и блок обращений.
     * Запускает сетевые запросы. При ошибке показывает inline-сообщение.
     */
    public async mount(): Promise<void> {
        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Статистика платформы';
        this.#parent.appendChild(title);

        try {
            const stats = await this.#api.getStats();
            this.#renderKpiGrid([
                {
                    label: 'Пользователи',
                    value: stats.total_users,
                    tooltip: 'Общее количество зарегистрированных пользователей на платформе'
                },
                {
                    label: 'Блокноты',
                    value: stats.total_notebooks,
                    tooltip: 'Общее количество блокнотов на платформе'
                },
                {
                    label: 'DAU',
                    value: stats.dau,
                    tooltip: 'Daily Active Users — уникальные пользователи за последние 24 часа'
                },
                {
                    label: 'MAU',
                    value: stats.mau,
                    tooltip: 'Monthly Active Users — уникальные пользователи за последние 30 дней'
                }
            ]);

            const activityData = await this.#api.getActivityStats(
                CHART_DAYS_RANGE,
                CHART_MONTHS_RANGE
            );
            this.#renderTimeSeriesChart(
                'DAU (последние 30 дней)',
                this.#fillDays(activityData.dau, CHART_DAYS_RANGE),
                'date',
                'count'
            );
            this.#renderTimeSeriesChart(
                'MAU (последние 12 месяцев)',
                this.#fillMonths(activityData.mau, CHART_MONTHS_RANGE),
                'month',
                'count'
            );

            await this.#renderIssuesSubsection();
        } catch (e: unknown) {
            const err = document.createElement('div');
            err.className = 'admin-empty';
            err.textContent = `Ошибка загрузки: ${(e as Error).message}`;
            this.#parent.appendChild(err);
        }
    }

    /**
     * Очищает родительский элемент. Виджет не имеет долгоживущих
     * подписок (нет таймеров и WS), поэтому очистка тривиальная.
     */
    public unmount(): void {
        this.#parent.innerHTML = '';
    }

    /**
     * Рендерит сетку из 4 KPI-карточек с tooltip-подсказками.
     * @param cards - массив описаний карточек (label, value, tooltip)
     */
    #renderKpiGrid(cards: { label: string; value: number; tooltip: string }[]): void {
        const grid = document.createElement('div');
        grid.className = 'admin-stats-grid';
        cards.forEach(({ label, value, tooltip }) => {
            const card = document.createElement('div');
            card.className = 'admin-stat-card';
            card.innerHTML = `<div class="admin-stat-card__value">${escapeHtml(value)}</div><div class="admin-stat-card__label">${escapeHtml(label)} <span class="admin-stat-card__hint">?<span class="admin-stat-card__tooltip">${escapeHtml(tooltip)}</span></span></div>`;
            grid.appendChild(card);
        });
        this.#parent.appendChild(grid);
    }

    /**
     * Рендерит подсекцию обращений (4 KPI + категориальная диаграмма).
     * Если getIssueStats упал — пропускает блок без падения всей секции.
     */
    async #renderIssuesSubsection(): Promise<void> {
        const issueStats = await this.#api.getIssueStats().catch((e: unknown) => {
            logError('Failed to load issue stats:', e);
            return null;
        });
        if (!issueStats) return;

        const issueTitle = document.createElement('h2');
        issueTitle.className = 'admin-page__section-title';
        issueTitle.style.marginTop = '32px';
        issueTitle.textContent = 'Обращения';
        this.#parent.appendChild(issueTitle);

        this.#renderKpiGrid([
            {
                label: 'Всего',
                value: issueStats.total,
                tooltip: 'Общее количество обращений от пользователей'
            },
            {
                label: 'Открыто',
                value: issueStats.open,
                tooltip: 'Обращения, ожидающие рассмотрения'
            },
            {
                label: 'В работе',
                value: issueStats.in_progress,
                tooltip: 'Обращения, находящиеся в работе'
            },
            { label: 'Закрыто', value: issueStats.closed, tooltip: 'Решённые обращения' }
        ]);

        const cat = issueStats.by_category;
        const categoryData = [
            { label: 'Ошибки', count: cat.bug },
            { label: 'Предложения', count: cat.idea },
            { label: 'Проблемы', count: cat.problem },
            { label: 'Общее', count: cat.feedback }
        ];
        this.#renderTimeSeriesChart('Обращения по категориям', categoryData, 'label', 'count');
    }

    /**
     * Рендерит SVG столбчатую диаграмму с подписями по оси X и сеткой по Y.
     * Сам строит SVG-разметку без внешних библиотек.
     * @param titleText - заголовок диаграммы
     * @param data - массив точек данных
     * @param keyField - имя поля с ключом X (date/month/label)
     * @param valueField - имя поля с числовым значением Y
     */
    #renderTimeSeriesChart(
        titleText: string,
        data: Record<string, unknown>[],
        keyField: string,
        valueField: string
    ): void {
        const chart = document.createElement('div');
        chart.className = 'admin-chart';
        chart.innerHTML = `<div class="admin-chart__title">${escapeHtml(titleText)}</div>`;

        const maxVal = Math.max(...data.map((e) => e[valueField] as number), 1);
        const width = 700;
        const height = 220;
        const padding = { left: 44, right: 10, top: 20, bottom: 54 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const gap = 3;
        const barW = Math.max(4, Math.floor(chartW / data.length) - gap);
        const offsetX = padding.left;
        const ticks = this.#calcYTicks(maxVal);

        let svg = `<svg viewBox="0 0 ${String(width)} ${String(height)}" class="admin-chart__svg">`;
        svg += `<line x1="${String(padding.left)}" y1="${String(padding.top + chartH)}" x2="${String(padding.left + chartW)}" y2="${String(padding.top + chartH)}" stroke="var(--cell-border)" stroke-width="1"/>`;

        ticks.forEach(({ value, label }) => {
            const y = padding.top + chartH - (value / maxVal) * chartH;
            svg += `<text x="${String(padding.left - 6)}" y="${String(y + 4)}" text-anchor="end" font-size="10" fill="var(--accent)">${label}</text>`;
            if (value > 0) {
                svg += `<line x1="${String(padding.left)}" y1="${String(y)}" x2="${String(padding.left + chartW)}" y2="${String(y)}" stroke="var(--light-grey)" stroke-width="1" stroke-dasharray="4,3"/>`;
            }
        });

        const labelStep = Math.max(1, Math.ceil(data.length / 15));
        data.forEach((entry, i) => {
            const x = offsetX + i * (barW + gap);
            const val = entry[valueField] as number;
            const barH = val > 0 ? Math.max(2, (val / maxVal) * chartH) : 0;
            const y = padding.top + chartH - barH;
            const opacity = val > 0 ? 1 : 0.15;
            svg += `<rect x="${String(x)}" y="${String(val > 0 ? y : padding.top + chartH - 2)}" width="${String(barW)}" height="${String(val > 0 ? barH : 2)}" fill="var(--teal-green)" opacity="${String(opacity)}" rx="1"><title>${this.#formatChartLabel(entry[keyField] as string, keyField)}: ${String(val)}</title></rect>`;

            if (i % labelStep === 0) {
                const lbl = this.#formatChartLabel(entry[keyField] as string, keyField);
                const tx = x + barW / 2;
                const ty = padding.top + chartH + 10;
                svg += `<text x="${String(tx)}" y="${String(ty)}" text-anchor="end" font-size="9" fill="var(--accent)" transform="rotate(-45 ${String(tx)} ${String(ty)})">${lbl}</text>`;
            }
        });

        svg += '</svg>';
        chart.innerHTML += svg;
        this.#parent.appendChild(chart);
    }

    /**
     * Форматирует подпись точки оси X в зависимости от типа keyField.
     * @param raw - сырая строка ключа из данных
     * @param keyField - тип ключа: 'date', 'month' или иное
     * @returns отформатированная подпись
     */
    #formatChartLabel(raw: string, keyField: string): string {
        if (keyField === 'date') {
            const parts = raw.split('-');
            if (parts.length === 3) {
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                return `${parts[2]}.${parts[1]}.${parts[0].slice(2)}(${DAYS_OF_WEEK[d.getDay()]})`;
            }
        }
        if (keyField === 'month') {
            const parts = raw.split('-');
            if (parts.length === 2) return `${parts[1]}.${parts[0].slice(2)}`;
        }
        return raw;
    }

    /**
     * Считает «красивые» tick'и для оси Y. Для maxVal ≤ 5 — целые шаги по 1,
     * иначе 5 шагов с шагом ceil(maxVal/4) с обрезкой на maxVal.
     * @param maxVal - максимальное значение по данным
     * @returns массив tick'ов с числовым value и строковым label
     */
    #calcYTicks(maxVal: number): YTick[] {
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
     * Дозаполняет timeseries по дням за последние `count` дней нулями для
     * тех дат, которых нет в `entries`.
     * @param entries - данные с сервера (только активные дни)
     * @param count - сколько последних дней нужно заполнить
     * @returns непрерывный массив длиной `count`, отсортированный по дате
     */
    #fillDays(entries: DayPoint[], count: number): DayPoint[] {
        const map = new Map<string, number>();
        entries.forEach((e) => map.set(e.date, e.count));
        const result: DayPoint[] = [];
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
     * Аналог fillDays для месяцев: дозаполняет timeseries за последние
     * `count` месяцев нулями. Ключ месяца формата `YYYY-MM`.
     * @param entries - данные с сервера (только активные месяцы)
     * @param count - сколько последних месяцев заполнить
     * @returns непрерывный массив длиной `count`, отсортированный по месяцу
     */
    #fillMonths(entries: MonthPoint[], count: number): MonthPoint[] {
        const map = new Map<string, number>();
        entries.forEach((e) => map.set(e.month, e.count));
        const result: MonthPoint[] = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            result.push({ month: key, count: map.get(key) ?? 0 });
        }
        return result;
    }
}
