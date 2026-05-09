import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { AdminApi } from '../../shared/api/AdminApi.js';
import { Router } from '../../shared/router/Router.js';
import { ContextMenu } from '../../shared/components/context-menu/ContextMenu.js';
import { Modal } from '../../shared/components/modal/Modal.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Возвращает HTML-каркас админ-страницы: sidebar с четырьмя пунктами
 * (Статистика / Пользователи / Блокноты / Обращения) и пустую область
 * `.admin-page__content`, которую заполняет AdminPage в зависимости от
 * выбранной секции.
 * @returns HTML-строка корневого `<main>` элемента
 */
function AdminPageTemplate(): string {
    return `<main class="admin-page">
    <div class="admin-page__container">
        <nav class="admin-page__sidebar">
            <div class="admin-page__sidebar-group">
                <h3 class="admin-page__sidebar-title">Управление</h3>
                <button class="admin-page__sidebar-item admin-page__sidebar-item--active" data-section="stats">Статистика</button>
                <button class="admin-page__sidebar-item" data-section="users">Пользователи</button>
                <button class="admin-page__sidebar-item" data-section="notebooks">Блокноты</button>
                <button class="admin-page__sidebar-item" data-section="issues">Обращения</button>
            </div>
        </nav>
        <div class="admin-page__content"></div>
    </div>
</main>`;
}

const PLAN_BADGES: Record<string, { cls: string; label: string }> = {
    free: { cls: 'admin-badge--free', label: 'Free' },
    freeze: { cls: 'admin-badge--freeze', label: 'Freeze' },
    pro: { cls: 'admin-badge--pro', label: 'Pro' },
    max: { cls: 'admin-badge--max', label: 'Max' },
    admin: { cls: 'admin-badge--admin', label: 'Admin' }
};

const PLAN_OPTIONS = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'max', label: 'Max' },
    { value: 'admin', label: 'Admin' }
];

const ISSUE_STATUS_BADGES: Record<string, { cls: string; label: string }> = {
    open: { cls: 'admin-badge--active', label: 'Новое' },
    new: { cls: 'admin-badge--active', label: 'Новое' },
    in_progress: { cls: 'admin-badge--pro', label: 'В работе' },
    resolved: { cls: 'admin-badge--free', label: 'Решено' },
    closed: { cls: 'admin-badge--freeze', label: 'Закрыто' }
};

const ISSUE_CATEGORY_BADGES: Record<string, { cls: string; label: string }> = {
    bug: { cls: 'admin-badge--banned', label: 'Ошибка' },
    idea: { cls: 'admin-badge--pro', label: 'Предложение' },
    problem: { cls: 'admin-badge--freeze', label: 'Проблема' },
    feedback: { cls: 'admin-badge--active', label: 'Общее мнение' }
};

const ISSUE_STATUS_OPTIONS = [
    { value: 'open', label: 'Новое' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'resolved', label: 'Решено' },
    { value: 'closed', label: 'Закрыто' }
];

/**
 * Админ-панель платформы (`/admin`, доступна только пользователям с is_admin=true).
 * Содержит 4 секции: Статистика (DAU/MAU/MAU графики, обращения по категориям),
 * Пользователи (CRUD, смена тарифа, отправка email, бан), Блокноты (просмотр+удаление),
 * Обращения (issue-tracker с категориями bug/idea/problem/feedback и статусами
 * open/in_progress/resolved/closed, ответы на обращения).
 *
 * Перед рендером проверяет права через /auth/me; не-админ → редирект на /files.
 * Использует кастомный ContextMenu для action'ов и Modal для форм-диалогов.
 */
export class AdminPage {
    #root: HTMLElement;
    #httpClient: HttpClient;
    #adminApi: AdminApi;
    #user: Record<string, unknown> | null = null;
    #activeKey = 'stats';
    #contentArea: HTMLElement | null = null;
    #searchTimeout: ReturnType<typeof setTimeout> | null = null;
    #contextMenu: ContextMenu | null = null;
    #modal: Modal | null = null;
    #currentUserPage = 1;
    #currentUserSearch = '';
    #currentNbPage = 1;
    #currentNbSearch = '';
    #currentIssuePage = 1;
    #currentIssueSearch = '';
    #feedbackModal: FeedbackModal | null = null;

    /**
     * Сохраняет root, инициализирует HttpClient (singleton) и новый
     * экземпляр AdminApi для всех админ-вызовов.
     * @param root - корневой элемент SPA
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
        this.#adminApi = new AdminApi();
    }

    /**
     * Загружает данные пользователя через /auth/me, проверяет is_admin,
     * рендерит шапку GreenHeader, sidebar-каркас (через AdminPageTemplate)
     * и показывает дефолтную секцию 'stats'. При не-админе → редирект на /files,
     * при неавторизации → /sign.
     */
    public async render(): Promise<void> {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                nn(Router.getInstance()).navigate('/sign');
                return;
            }
            const { data: user } = (await response.json()) as { data: Record<string, unknown> };
            if (user.is_admin !== true) {
                nn(Router.getInstance()).navigate('/files');
                return;
            }
            this.#user = user;
        } catch (_e) {
            nn(Router.getInstance()).navigate('/sign');
            return;
        }

        const initials = (this.#user.username as string).substring(0, 2).toUpperCase();
        const header = new GreenHeader(this.#root, {
            user: {
                username: this.#user.username as string,
                initials,
                avatarUrl: (this.#user.avatar_url as string) || ''
            },
            onProfile: (): void => {
                nn(Router.getInstance()).navigate('/profile');
            },
            onAdmin: (): void => {
                /* noop */
            },
            onFeedback: (): void => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onLogout: async (): Promise<void> => {
                await this.#httpClient.post('/auth/logout').catch(() => {
                    /* noop */
                });
                nn(Router.getInstance()).navigate('/sign');
            }
        });
        header.render();

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = AdminPageTemplate();
        const main = nn(tempContainer.firstElementChild);
        this.#root.appendChild(main);

        this.#contentArea = nn(main.querySelector('.admin-page__content'));
        this.#contextMenu = new ContextMenu();
        this.#modal = new Modal();
        this.#attachSidebarEvents(main as HTMLElement);
        this.#showSection('stats');
    }

    /**
     * Навешивает обработчики кликов по пунктам sidebar'а: переключает
     * active-класс и вызывает #showSection. Игнорирует клик по уже
     * активной секции.
     * @param main - корневой элемент содержимого admin-страницы
     */
    #attachSidebarEvents(main: HTMLElement): void {
        const items = main.querySelectorAll('.admin-page__sidebar-item');
        items.forEach((item) => {
            item.addEventListener('click', () => {
                const section = (item as HTMLElement).dataset.section;
                if (section !== undefined && section !== this.#activeKey) {
                    items.forEach((i) => {
                        i.classList.remove('admin-page__sidebar-item--active');
                    });
                    item.classList.add('admin-page__sidebar-item--active');
                    this.#showSection(section);
                }
            });
        });
    }

    /**
     * Очищает контент-область и инициализирует выбранную секцию.
     * Switch по ключу: stats / users / notebooks / issues. Каждый init-метод
     * сбрасывает свою пагинацию и поиск, рендерит таблицу и навешивает
     * search-debounce.
     * @param key - идентификатор секции из sidebar'а
     */
    #showSection(key: string): void {
        this.#activeKey = key;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.#contentArea!.innerHTML = '';
        switch (key) {
            case 'stats':
                void this.#renderStats();
                break;
            case 'users':
                this.#initUsersSection();
                break;
            case 'notebooks':
                this.#initNotebooksSection();
                break;
            case 'issues':
                this.#initIssuesSection();
                break;
            default:
                break;
        }
    }

    /**
     * Рендерит секцию "Статистика": 4 карточки KPI (users/notebooks/DAU/MAU),
     * два timeseries-графика (DAU за 30 дней, MAU за 12 месяцев) и блок по
     * обращениям (4 карточки + категориальная диаграмма). Каждая карточка
     * имеет hover-tooltip с расшифровкой метрики. При ошибке загрузки
     * показывает inline-сообщение.
     */
    async #renderStats(): Promise<void> {
        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Статистика платформы';
        nn(this.#contentArea).appendChild(title);

        try {
            const stats = await this.#adminApi.getStats();
            const cards = [
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
            ];

            const grid = document.createElement('div');
            grid.className = 'admin-stats-grid';
            cards.forEach(({ label, value, tooltip }) => {
                const card = document.createElement('div');
                card.className = 'admin-stat-card';
                card.innerHTML = `<div class="admin-stat-card__value">${this.#esc(value)}</div><div class="admin-stat-card__label">${this.#esc(label)} <span class="admin-stat-card__hint">?<span class="admin-stat-card__tooltip">${this.#esc(tooltip)}</span></span></div>`;
                grid.appendChild(card);
            });
            nn(this.#contentArea).appendChild(grid);

            const activityData = await this.#adminApi.getActivityStats(30, 12);
            const dauFilled = this.#fillDays(activityData.dau, 30);
            const mauFilled = this.#fillMonths(activityData.mau, 12);
            this.#renderTimeSeriesChart('DAU (последние 30 дней)', dauFilled, 'date', 'count');
            this.#renderTimeSeriesChart('MAU (последние 12 месяцев)', mauFilled, 'month', 'count');

            const issueStats = await this.#adminApi.getIssueStats().catch(() => null);
            if (issueStats) {
                const issueTitle = document.createElement('h2');
                issueTitle.className = 'admin-page__section-title';
                issueTitle.style.marginTop = '32px';
                issueTitle.textContent = 'Обращения';
                nn(this.#contentArea).appendChild(issueTitle);

                const issueCards = [
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
                    {
                        label: 'Закрыто',
                        value: issueStats.closed,
                        tooltip: 'Решённые обращения'
                    }
                ];

                const issueGrid = document.createElement('div');
                issueGrid.className = 'admin-stats-grid';
                issueCards.forEach(({ label, value, tooltip }) => {
                    const card = document.createElement('div');
                    card.className = 'admin-stat-card';
                    card.innerHTML = `<div class="admin-stat-card__value">${this.#esc(value)}</div><div class="admin-stat-card__label">${this.#esc(label)} <span class="admin-stat-card__hint">?<span class="admin-stat-card__tooltip">${this.#esc(tooltip)}</span></span></div>`;
                    issueGrid.appendChild(card);
                });
                nn(this.#contentArea).appendChild(issueGrid);

                const cat = issueStats.by_category;
                const categoryData = [
                    { label: 'Ошибки', count: cat.bug },
                    { label: 'Предложения', count: cat.idea },
                    { label: 'Проблемы', count: cat.problem },
                    { label: 'Общее', count: cat.feedback }
                ];
                this.#renderTimeSeriesChart(
                    'Обращения по категориям',
                    categoryData,
                    'label',
                    'count'
                );
            }
        } catch (e: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.#contentArea!.innerHTML += `<div class="admin-empty">Ошибка загрузки: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    /**
     * Рендерит SVG столбчатую диаграмму с подписями по оси X и сеткой по Y.
     * Сам строит SVG-разметку без внешних библиотек: подбирает ширину столбцов
     * под количество точек, считает Y-tick'и через #calcYTicks, поворачивает
     * подписи на -45° и форматирует их через #formatChartLabel (даты/месяцы).
     * Прячет каждый второй-третий label если данных много (labelStep).
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
        chart.innerHTML = `<div class="admin-chart__title">${this.#esc(titleText)}</div>`;

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
            if (value > 0)
                svg += `<line x1="${String(padding.left)}" y1="${String(y)}" x2="${String(padding.left + chartW)}" y2="${String(y)}" stroke="var(--light-grey)" stroke-width="1" stroke-dasharray="4,3"/>`;
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
        nn(this.#contentArea).appendChild(chart);
    }

    /**
     * Форматирует подпись точки оси X в зависимости от типа keyField:
     * - 'date' (YYYY-MM-DD) → "DD.MM.YY(день_недели)"
     * - 'month' (YYYY-MM) → "MM.YY"
     * - всё остальное → как есть
     * @param raw - сырая строка ключа из данных
     * @param keyField - тип ключа: 'date', 'month' или иное
     * @returns отформатированная подпись для отображения
     */
    #formatChartLabel(raw: string, keyField: string): string {
        const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
        if (keyField === 'date') {
            const parts = raw.split('-');
            if (parts.length === 3) {
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                return `${parts[2]}.${parts[1]}.${parts[0].slice(2)}(${DAYS[d.getDay()]})`;
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
    #calcYTicks(maxVal: number): { value: number; label: string }[] {
        if (maxVal <= 0) return [{ value: 0, label: '0' }];
        if (maxVal <= 5) {
            const ticks: { value: number; label: string }[] = [];
            for (let i = 0; i <= maxVal; i++) ticks.push({ value: i, label: String(i) });
            return ticks;
        }
        const step = Math.ceil(maxVal / 4);
        const ticks: { value: number; label: string }[] = [];
        for (let i = 0; i <= 4; i++) {
            const v = step * i;
            ticks.push({ value: Math.min(v, maxVal), label: String(Math.min(v, maxVal)) });
        }
        return ticks;
    }

    /**
     * Дозаполняет timeseries по дням за последние `count` дней нулями для
     * тех дат, которых нет в `entries`. Нужно чтобы график был непрерывным
     * (без пропусков) и всегда показывал ровно `count` столбцов.
     * @param entries - данные с сервера (только активные дни)
     * @param count - сколько последних дней нужно заполнить
     * @returns непрерывный массив длиной `count`, отсортированный по дате
     */
    #fillDays(
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
     * Аналог #fillDays для месяцев: дозаполняет timeseries за последние
     * `count` месяцев нулями. Ключ месяца формата `YYYY-MM`.
     * @param entries - данные с сервера (только активные месяцы)
     * @param count - сколько последних месяцев заполнить
     * @returns непрерывный массив длиной `count`, отсортированный по месяцу
     */
    #fillMonths(
        entries: { month: string; count: number }[],
        count: number
    ): { month: string; count: number }[] {
        const map = new Map<string, number>();
        entries.forEach((e) => map.set(e.month, e.count));
        const result: { month: string; count: number }[] = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            result.push({ month: key, count: map.get(key) ?? 0 });
        }
        return result;
    }

    /**
     * Инициализирует секцию "Пользователи": сбрасывает пагинацию и поиск,
     * рендерит заголовок + поисковую строку (с debounce 300ms) +
     * счётчик найденных + таблицу. Запускает первый refresh таблицы.
     */
    #initUsersSection(): void {
        this.#currentUserPage = 1;
        this.#currentUserSearch = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Пользователи';
        nn(this.#contentArea).appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по имени или email...';
        searchInput.addEventListener('input', () => {
            clearTimeout(nn(this.#searchTimeout));
            this.#searchTimeout = setTimeout(() => {
                this.#currentUserSearch = searchInput.value;
                this.#currentUserPage = 1;
                void this.#refreshUsersTable();
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'user-count';
        header.appendChild(countEl);
        nn(this.#contentArea).appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        nn(this.#contentArea).appendChild(tableContainer);

        void this.#refreshUsersTable();
    }

    /**
     * Перезагружает таблицу пользователей с учётом текущей страницы и поиска.
     * Показывает badge тарифа, статус (banned/не подтверждён), относительное
     * время последней активности, общее время использования и дату регистрации.
     * Контекстное меню (правый клик) — через #showUserContextMenu.
     * При >1 страницы добавляет пагинатор.
     */
    async #refreshUsersTable(): Promise<void> {
        const tableContainer = nn(this.#contentArea).querySelector('.admin-table-container');
        const countEl = nn(this.#contentArea).querySelector('[data-role="user-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const limit = 15;
        const offset = (this.#currentUserPage - 1) * limit;

        try {
            const data = await this.#adminApi.getUsers(limit, offset, this.#currentUserSearch);
            const users = data.users as unknown as Record<string, unknown>[];
            const total = data.total;
            if (countEl)
                countEl.textContent = `${String(total)} пользовател${this.#plural(total, 'ь', 'я', 'ей')}`;

            if (users.length === 0) {
                tableContainer.innerHTML = '<div class="admin-empty">Пользователи не найдены</div>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<colgroup>
                <col style="width:50px"><col style="width:18%"><col style="width:22%">
                <col style="width:80px"><col style="width:100px"><col style="width:100px">
                <col style="width:110px"><col style="width:100px">
            </colgroup>
            <thead><tr>
                <th>ID</th><th>Имя</th><th>Email</th><th>Группа</th>
                <th>Активность</th><th>Общее время</th><th>Регистрация</th><th>Статус</th>
            </tr></thead>`;

            const tbody = document.createElement('tbody');
            users.forEach((user) => {
                const tr = document.createElement('tr');
                const badge = this.#planBadge(user.plan as string);
                const isBanned = user.status === 'banned';
                let statusBadge = '';
                if (isBanned) {
                    statusBadge = '<span class="admin-badge admin-badge--banned">banned</span>';
                } else if (user.is_verified !== true) {
                    statusBadge =
                        '<span class="admin-badge admin-badge--freeze">не подтверждён</span>';
                }

                tr.innerHTML = `
                    <td class="admin-table__muted">${String(user.id)}</td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(user.username as string)}"><strong>${this.#esc(user.username as string)}</strong></td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(user.email as string)}">${this.#esc(user.email as string)}</td>
                    <td>${badge}</td>
                    <td class="admin-table__muted">${this.#formatRelativeTime(user.last_active_at as string)}</td>
                    <td class="admin-table__muted">${this.#formatDuration((user.total_time_seconds as number) || 0)}</td>
                    <td class="admin-table__muted">${new Date(user.created_at as string).toLocaleDateString('ru-RU')}</td>
                    <td>${statusBadge}</td>`;

                tr.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.#showUserContextMenu(e, user);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);

            const totalPages = Math.ceil(total / limit);
            if (totalPages > 1) {
                this.#renderPagination(
                    tableContainer as HTMLElement,
                    this.#currentUserPage,
                    totalPages,
                    (p: number) => {
                        this.#currentUserPage = p;
                        void this.#refreshUsersTable();
                    }
                );
            }
        } catch (e: unknown) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    /**
     * Открывает контекстное меню для строки пользователя в координатах клика.
     * Базовые действия: изменить имя/email/пароль/тариф, отправить email.
     * "Забанить" добавляется только если: это не сам админ, plan=freeze
     * и пользователь ещё не забанен (защита от случайного бана активных).
     * @param e - событие contextmenu (для координат)
     * @param user - объект пользователя из таблицы
     */
    #showUserContextMenu(e: MouseEvent, user: Record<string, unknown>): void {
        const actions: { label: string; danger?: boolean; handler: () => void }[] = [];
        actions.push({
            label: 'Изменить имя',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#editUsername(user)
        });
        actions.push({
            label: 'Изменить email',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#editEmail(user)
        });
        actions.push({
            label: 'Сменить пароль',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#changePassword(user)
        });
        actions.push({
            label: 'Изменить тариф',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#changePlan(user)
        });
        actions.push({
            label: 'Отправить email',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            handler: () => this.#sendEmailToUser(user)
        });
        if (user.id !== nn(this.#user).id && user.plan === 'freeze' && user.status !== 'banned') {
            actions.push({
                label: 'Забанить',
                danger: true,
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                handler: () => this.#banUser(user)
            });
        }
        nn(this.#contextMenu).show(e.clientX, e.clientY, actions);
    }

    /**
     * Открывает Modal с одним полем username, предзаполненным текущим
     * значением. При сохранении вызывает PUT /admin/users/:id и обновляет
     * таблицу. Если значение не изменилось — no-op.
     * @param user - редактируемый пользователь
     */
    async #editUsername(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Изменить имя', [
            {
                name: 'username',
                label: 'Имя пользователя',
                type: 'text',
                value: user.username as string
            }
        ]);
        if (!result || result.username === user.username) return;
        try {
            await this.#adminApi.updateUser(user.id as string | number, {
                username: result.username,
                email: user.email
            });
            void this.#refreshUsersTable();
        } catch (e: unknown) {
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Открывает Modal с одним полем email и при сохранении вызывает PUT
     * /admin/users/:id. Backend проверяет валидность и уникальность email;
     * при ошибке показывает alert.
     * @param user - редактируемый пользователь
     */
    async #editEmail(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Изменить email', [
            { name: 'email', label: 'Email', type: 'text', value: user.email as string }
        ]);
        if (!result || result.email === user.email) return;
        try {
            await this.#adminApi.updateUser(user.id as string | number, {
                username: user.username,
                email: result.email
            });
            void this.#refreshUsersTable();
        } catch (e: unknown) {
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Открывает Modal для ввода нового пароля и вызывает админский
     * resetPassword endpoint (без подтверждения старого). Минимум 8 символов
     * проверяется на бэке. По успеху — alert("Пароль изменён").
     * @param user - пользователь, которому меняем пароль
     */
    async #changePassword(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Сменить пароль', [
            { name: 'password', label: 'Новый пароль (минимум 8 символов)', type: 'password' }
        ]);
        if (result?.password === undefined || result.password === '') return;
        try {
            await this.#adminApi.resetPassword(user.id as string | number, result.password);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert('Пароль изменён');
        } catch (e: unknown) {
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Открывает Modal с select из PLAN_OPTIONS (free/pro/max/admin) и
     * вызывает PUT /admin/users/:id/plan. Если тариф не изменился — no-op.
     * @param user - пользователь, которому меняем тариф
     */
    async #changePlan(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Изменить тариф', [
            {
                name: 'plan',
                label: 'Тариф',
                type: 'select',
                value: user.plan as string,
                options: PLAN_OPTIONS
            }
        ]);
        if (!result || result.plan === user.plan) return;
        try {
            await this.#adminApi.setPlan(user.id as string | number, result.plan);
            void this.#refreshUsersTable();
        } catch (e: unknown) {
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Открывает Modal с двумя полями (subject + textarea body) и отправляет
     * письмо пользователю через POST /admin/email. Используется для ручных
     * уведомлений. По успеху — alert("Письмо отправлено").
     * @param user - получатель письма
     */
    async #sendEmailToUser(user: Record<string, unknown>): Promise<void> {
        const result = await nn(this.#modal).open('Отправить email', [
            { name: 'subject', label: 'Тема', type: 'text' },
            { name: 'body', label: 'Сообщение', type: 'textarea' }
        ]);
        if (result === null || result.subject === '' || result.body === '') return;
        try {
            await this.#adminApi.sendEmail(user.email as string, result.subject, result.body);
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert('Письмо отправлено');
        } catch (e: unknown) {
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Банит пользователя после native confirm-диалога. По успеху бэк
     * автоматически делает все его публичные блокноты приватными.
     * @param user - блокируемый пользователь
     */
    async #banUser(user: Record<string, unknown>): Promise<void> {
        // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
        if (!confirm(`Забанить "${String(user.username)}"? Публичные блокноты станут приватными.`))
            return;
        try {
            await this.#adminApi.banUser(user.id as string | number);
            void this.#refreshUsersTable();
        } catch (e: unknown) {
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            alert((e as Error).message);
        }
    }

    /**
     * Инициализирует секцию "Блокноты": сбрасывает пагинацию/поиск,
     * рендерит заголовок + поиск (debounce 300ms) + счётчик + таблицу.
     * Запускает первый refresh таблицы.
     */
    #initNotebooksSection(): void {
        this.#currentNbPage = 1;
        this.#currentNbSearch = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Блокноты';
        nn(this.#contentArea).appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по названию...';
        searchInput.addEventListener('input', () => {
            clearTimeout(nn(this.#searchTimeout));
            this.#searchTimeout = setTimeout(() => {
                this.#currentNbSearch = searchInput.value;
                this.#currentNbPage = 1;
                void this.#refreshNotebooksTable();
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'nb-count';
        header.appendChild(countEl);
        nn(this.#contentArea).appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        nn(this.#contentArea).appendChild(tableContainer);

        void this.#refreshNotebooksTable();
    }

    /**
     * Перезагружает таблицу блокнотов: ID, название, owner_id, badge доступа
     * (public/private), дата создания. Контекстное меню — только удаление
     * (с native confirm). При >1 страницы добавляет пагинатор.
     */
    async #refreshNotebooksTable(): Promise<void> {
        const tableContainer = nn(this.#contentArea).querySelector('.admin-table-container');
        const countEl = nn(this.#contentArea).querySelector('[data-role="nb-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const limit = 15;
        const offset = (this.#currentNbPage - 1) * limit;

        try {
            const data = await this.#adminApi.getNotebooks(limit, offset, this.#currentNbSearch);
            const notebooks = data.notebooks as unknown as Record<string, unknown>[];
            const total = data.total;
            if (countEl)
                countEl.textContent = `${String(total)} блокнот${this.#plural(total, '', 'а', 'ов')}`;

            if (notebooks.length === 0) {
                tableContainer.innerHTML = '<div class="admin-empty">Блокноты не найдены</div>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<colgroup>
                <col style="width:50px"><col style="width:40%"><col style="width:80px">
                <col style="width:80px"><col style="width:120px">
            </colgroup>
            <thead><tr>
                <th>ID</th><th>Название</th><th>Owner ID</th><th>Доступ</th><th>Создан</th>
            </tr></thead>`;

            const tbody = document.createElement('tbody');
            notebooks.forEach((nb) => {
                const tr = document.createElement('tr');
                const accessBadge =
                    nb.is_public !== undefined && nb.is_public !== null
                        ? '<span class="admin-badge admin-badge--active">public</span>'
                        : '<span class="admin-badge">private</span>';

                tr.innerHTML = `
                    <td class="admin-table__muted">${String(nb.id)}</td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(nb.title as string)}"><strong>${this.#esc(nb.title as string)}</strong></td>
                    <td class="admin-table__muted">${String(nb.owner_id)}</td>
                    <td>${accessBadge}</td>
                    <td class="admin-table__muted">${new Date(nb.created_at as string).toLocaleDateString('ru-RU')}</td>`;

                tr.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    nn(this.#contextMenu).show(e.clientX, e.clientY, [
                        {
                            label: 'Удалить',
                            danger: true,
                            // eslint-disable-next-line @typescript-eslint/no-misused-promises
                            handler: async (): Promise<void> => {
                                // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
                                if (confirm(`Удалить блокнот "${String(nb.title)}"?`)) {
                                    try {
                                        await this.#adminApi.deleteNotebook(
                                            nb.id as string | number
                                        );
                                        void this.#refreshNotebooksTable();
                                    } catch (err: unknown) {
                                        // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
                                        alert((err as Error).message);
                                    }
                                }
                            }
                        }
                    ]);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);

            const totalPages = Math.ceil(total / limit);
            if (totalPages > 1) {
                this.#renderPagination(
                    tableContainer as HTMLElement,
                    this.#currentNbPage,
                    totalPages,
                    (p: number) => {
                        this.#currentNbPage = p;
                        void this.#refreshNotebooksTable();
                    }
                );
            }
        } catch (e: unknown) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    /**
     * Рендерит компактный пагинатор: кнопка "<", до 5 страниц вокруг текущей
     * (current ± 2), кнопка ">". Активная страница выделена CSS-модификатором.
     * Используется для всех трёх таблиц admin'а (users/notebooks/issues).
     * @param container - DOM-элемент, в который добавлять пагинатор
     * @param current - текущая страница (1-based)
     * @param total - общее количество страниц
     * @param onPage - колбэк при клике на номер страницы
     */
    #renderPagination(
        container: HTMLElement,
        current: number,
        total: number,
        onPage: (p: number) => void
    ): void {
        const nav = document.createElement('div');
        nav.className = 'admin-pagination';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'admin-pagination__btn';
        prevBtn.textContent = '<';
        prevBtn.disabled = current <= 1;
        prevBtn.addEventListener('click', () => {
            onPage(current - 1);
        });
        nav.appendChild(prevBtn);

        const start = Math.max(1, current - 2);
        const end = Math.min(total, current + 2);

        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.className = 'admin-pagination__btn';
            if (i === current) btn.classList.add('admin-pagination__btn--active');
            btn.textContent = String(i);
            btn.addEventListener('click', () => {
                onPage(i);
            });
            nav.appendChild(btn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'admin-pagination__btn';
        nextBtn.textContent = '>';
        nextBtn.disabled = current >= total;
        nextBtn.addEventListener('click', () => {
            onPage(current + 1);
        });
        nav.appendChild(nextBtn);

        container.appendChild(nav);
    }

    /**
     * Возвращает HTML-разметку бейджа тарифа из PLAN_BADGES. Неизвестный
     * тариф fallback'ит на 'free'.
     * @param plan - идентификатор тарифа (free/freeze/pro/max/admin)
     * @returns HTML-строка span'а с классом и текстом бейджа
     */
    #planBadge(plan: string): string {
        const b = (PLAN_BADGES[plan] as typeof PLAN_BADGES.free | undefined) ?? PLAN_BADGES.free;
        return `<span class="admin-badge ${b.cls}">${b.label}</span>`;
    }

    /**
     * Форматирует дату в относительный человекочитаемый вид:
     * "Только что" (<1 мин), "N мин. назад", "N ч. назад", "N дн. назад"
     * (для <30 дней), иначе абсолютная дата ru-RU. Пустая строка → "—".
     * @param dateStr - ISO-строка даты или пустая строка
     * @returns строка для отображения в UI
     */
    #formatRelativeTime(dateStr: string): string {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const diffMs = Date.now() - date.getTime();
        if (diffMs < 0) return 'Только что';
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'Только что';
        if (diffMin < 60) return `${String(diffMin)} мин. назад`;
        const diffHrs = Math.floor(diffMin / 60);
        if (diffHrs < 24) return `${String(diffHrs)} ч. назад`;
        const diffDays = Math.floor(diffHrs / 24);
        if (diffDays < 30) return `${String(diffDays)} дн. назад`;
        return date.toLocaleDateString('ru-RU');
    }

    /**
     * Форматирует общее время в секундах в "N ч. M мин." (или просто
     * "M мин." если меньше часа). Нулевое/отрицательное → "0 мин.".
     * @param seconds - длительность в секундах
     * @returns человекочитаемая строка длительности
     */
    #formatDuration(seconds: number): string {
        if (!seconds || seconds <= 0) return '0 мин.';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${String(hrs)} ч. ${String(mins)} мин.`;
        return `${String(mins)} мин.`;
    }

    /**
     * Локальный HTML-эскейпер: создаёт временный div и читает его innerHTML
     * после установки textContent. Используется для безопасной интерполяции
     * пользовательских данных в шаблонные строки. (Аналог shared/utils/escapeHtml.)
     * @param value - значение для эскейпа (строка или число)
     * @returns HTML-безопасная строка
     */
    #esc(value: string | number): string {
        const div = document.createElement('div');
        div.textContent = String(value);
        return div.innerHTML;
    }

    /**
     * Возвращает корректную форму существительного для русского
     * множественного числа (1 пользователь, 2 пользователя, 5 пользователей).
     * Учитывает исключения 11-19 → many. Используется в счётчиках таблиц.
     * @param n - число
     * @param one - форма для 1 (например "пользователь")
     * @param few - форма для 2-4 (например "пользователя")
     * @param many - форма для 0/5+/11-19 (например "пользователей")
     * @returns правильная форма для числа n
     */
    #plural(n: number, one: string, few: string, many: string): string {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 19) return many;
        if (mod10 === 1) return one;
        if (mod10 >= 2 && mod10 <= 4) return few;
        return many;
    }

    /**
     * Инициализирует секцию "Обращения" (от пользователей через FeedbackModal):
     * сбрасывает пагинацию/поиск, рендерит заголовок + поиск (debounce 300ms)
     * + счётчик + таблицу. Запускает первый refresh таблицы.
     */
    #initIssuesSection(): void {
        this.#currentIssuePage = 1;
        this.#currentIssueSearch = '';

        const title = document.createElement('h2');
        title.className = 'admin-page__section-title';
        title.textContent = 'Обращения';
        nn(this.#contentArea).appendChild(title);

        const header = document.createElement('div');
        header.className = 'admin-table-header';

        const searchInput = document.createElement('input');
        searchInput.className = 'admin-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Поиск по содержанию...';
        searchInput.addEventListener('input', () => {
            clearTimeout(nn(this.#searchTimeout));
            this.#searchTimeout = setTimeout(() => {
                this.#currentIssueSearch = searchInput.value;
                this.#currentIssuePage = 1;
                void this.#refreshIssuesTable();
            }, 300);
        });
        header.appendChild(searchInput);

        const countEl = document.createElement('span');
        countEl.className = 'admin-count';
        countEl.dataset.role = 'issue-count';
        header.appendChild(countEl);
        nn(this.#contentArea).appendChild(header);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        nn(this.#contentArea).appendChild(tableContainer);

        void this.#refreshIssuesTable();
    }

    /**
     * Перезагружает таблицу обращений: ID, badge категории
     * (bug/idea/problem/feedback), preview содержимого (60 символов),
     * user_id, badge статуса, дата. Клик по строке открывает детальный
     * вид через #showIssueDetail.
     */
    async #refreshIssuesTable(): Promise<void> {
        const tableContainer = nn(this.#contentArea).querySelector('.admin-table-container');
        const countEl = nn(this.#contentArea).querySelector('[data-role="issue-count"]');
        if (!tableContainer) return;
        tableContainer.innerHTML = '';

        const limit = 15;
        const offset = (this.#currentIssuePage - 1) * limit;

        try {
            const data = await this.#adminApi.getIssues(limit, offset, this.#currentIssueSearch);
            const issues = data.issues as unknown as Record<string, unknown>[];
            const total = data.total;
            if (countEl)
                countEl.textContent = `${String(total)} обращени${this.#plural(total, 'е', 'я', 'й')}`;

            if (issues.length === 0) {
                tableContainer.innerHTML = '<div class="admin-empty">Обращения не найдены</div>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<colgroup>
                <col style="width:50px"><col style="width:100px"><col style="width:40%">
                <col style="width:80px"><col style="width:90px"><col style="width:110px">
            </colgroup>
            <thead><tr>
                <th>ID</th><th>Категория</th><th>Содержание</th>
                <th>User ID</th><th>Статус</th><th>Дата</th>
            </tr></thead>`;

            const tbody = document.createElement('tbody');
            issues.forEach((issue) => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                const catBadge = this.#issueBadge(ISSUE_CATEGORY_BADGES, issue.category as string);
                const statusBadge = this.#issueBadge(ISSUE_STATUS_BADGES, issue.status as string);
                const content = issue.content as string;
                const preview = content.length > 60 ? `${content.substring(0, 60)}...` : content;

                tr.innerHTML = `
                    <td class="admin-table__muted">${String(issue.id)}</td>
                    <td>${catBadge}</td>
                    <td class="admin-table__cell-truncate" title="${this.#esc(content)}">${this.#esc(preview)}</td>
                    <td class="admin-table__muted">${String(issue.user_id)}</td>
                    <td>${statusBadge}</td>
                    <td class="admin-table__muted">${new Date(issue.created_at as string).toLocaleDateString('ru-RU')}</td>`;

                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                tr.addEventListener('click', () => this.#showIssueDetail(issue.id as number));
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);

            const totalPages = Math.ceil(total / limit);
            if (totalPages > 1) {
                this.#renderPagination(
                    tableContainer as HTMLElement,
                    this.#currentIssuePage,
                    totalPages,
                    (p: number) => {
                        this.#currentIssuePage = p;
                        void this.#refreshIssuesTable();
                    }
                );
            }
        } catch (e: unknown) {
            tableContainer.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    /**
     * Открывает детальный вид обращения: заголовок с категорией/статусом,
     * автор и дата, тело обращения, список вложений (если есть), цепочка
     * сообщений (диалог user ↔ admin), форма смены статуса и форма ответа.
     * Клик "Назад" возвращает в таблицу обращений через #showSection.
     * После успешного действия (смена статуса/ответ) — перезагружает деталь.
     * @param issueId - идентификатор обращения
     */
    async #showIssueDetail(issueId: number): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.#contentArea!.innerHTML = '';

        const backBtn = document.createElement('button');
        backBtn.className = 'admin-issue-detail__back-btn';
        backBtn.innerHTML = '&larr; Назад к обращениям';
        backBtn.addEventListener('click', () => {
            this.#showSection('issues');
        });
        nn(this.#contentArea).appendChild(backBtn);

        const container = document.createElement('div');
        container.className = 'admin-issue-detail';
        container.innerHTML = '<div class="admin-empty">Загрузка...</div>';
        nn(this.#contentArea).appendChild(container);

        try {
            const issue = (await this.#adminApi.getIssue(issueId)) as unknown as Record<
                string,
                unknown
            >;
            const catBadge = this.#issueBadge(ISSUE_CATEGORY_BADGES, issue.category as string);
            const statusBadge = this.#issueBadge(ISSUE_STATUS_BADGES, issue.status as string);
            const date = new Date(issue.created_at as string).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const attachments = issue.attachments as Record<string, unknown>[] | undefined;
            let attachmentsHtml = '';
            if (attachments && attachments.length > 0) {
                attachmentsHtml = `
                    <div class="admin-issue-detail__section">
                        <h4 class="admin-issue-detail__section-title">Вложения</h4>
                        <div class="admin-issue-detail__attachments">
                            ${attachments
                                .map(
                                    (att) =>
                                        `<a class="admin-issue-detail__attachment" href="/api/v1/issues/${String(issueId)}/attachments/${String(att.id)}" target="_blank">${this.#esc((att.filename ?? att.name ?? 'Файл') as string)}</a>`
                                )
                                .join('')}
                        </div>
                    </div>`;
            }

            const messages = issue.messages as Record<string, unknown>[] | undefined;
            let messagesHtml = '';
            if (messages && messages.length > 0) {
                const msgs = messages
                    .map((m) => {
                        const mDate = new Date(m.created_at as string).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        const author =
                            m.is_admin !== undefined && m.is_admin !== null
                                ? 'Администратор'
                                : (m.username as string) || `User #${String(m.user_id)}`;
                        const cls =
                            m.is_admin !== undefined && m.is_admin !== null
                                ? 'admin-issue-detail__message--admin'
                                : 'admin-issue-detail__message--user';
                        return `<div class="admin-issue-detail__message ${cls}">
                            <div class="admin-issue-detail__message-meta">
                                <span class="admin-issue-detail__message-author">${this.#esc(author)}</span>
                                <span class="admin-issue-detail__message-date">${mDate}</span>
                            </div>
                            <div class="admin-issue-detail__message-text">${this.#esc(m.content as string)}</div>
                        </div>`;
                    })
                    .join('');
                messagesHtml = `
                    <div class="admin-issue-detail__section">
                        <h4 class="admin-issue-detail__section-title">Сообщения</h4>
                        <div class="admin-issue-detail__messages">${msgs}</div>
                    </div>`;
            }

            container.innerHTML = `
                <h2 class="admin-page__section-title">Обращение #${String(issue.id)}</h2>
                <div class="admin-issue-detail__meta">
                    ${catBadge} ${statusBadge}
                    <span class="admin-table__muted">${this.#esc((issue.username as string) || `User #${String(issue.user_id)}`)}</span>
                    <span class="admin-table__muted">${date}</span>
                </div>
                <div class="admin-issue-detail__content">${this.#esc(issue.content as string)}</div>
                ${attachmentsHtml}
                ${messagesHtml}
                <div class="admin-issue-detail__actions">
                    <div class="admin-issue-detail__status-row">
                        <label class="admin-issue-detail__section-title">Статус</label>
                        <select class="admin-search" data-role="status-select">
                            ${ISSUE_STATUS_OPTIONS.map(
                                (opt) =>
                                    `<option value="${opt.value}" ${opt.value === issue.status ? 'selected' : ''}>${opt.label}</option>`
                            ).join('')}
                        </select>
                        <button class="admin-btn" data-role="update-status">Обновить</button>
                    </div>
                    <div class="admin-issue-detail__response-section">
                        <label class="admin-issue-detail__section-title">Ответить</label>
                        <textarea class="admin-issue-detail__textarea" placeholder="Введите ответ..."></textarea>
                        <button class="admin-btn" data-role="send-response">Отправить ответ</button>
                    </div>
                </div>`;

            const statusSelect = nn(
                container.querySelector<HTMLSelectElement>('[data-role="status-select"]')
            );
            const updateBtn = nn(
                container.querySelector<HTMLButtonElement>('[data-role="update-status"]')
            );
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            updateBtn.addEventListener('click', async () => {
                try {
                    await this.#adminApi.updateIssueStatus(issueId, statusSelect.value);
                    void this.#showIssueDetail(issueId);
                } catch (e: unknown) {
                    // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
                    alert((e as Error).message);
                }
            });

            const responseTextarea = nn(
                container.querySelector<HTMLTextAreaElement>('.admin-issue-detail__textarea')
            );
            const sendBtn = nn(
                container.querySelector<HTMLButtonElement>('[data-role="send-response"]')
            );
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            sendBtn.addEventListener('click', async () => {
                const text = responseTextarea.value.trim();
                if (!text) return;
                try {
                    await this.#adminApi.respondToIssue(issueId, text);
                    void this.#showIssueDetail(issueId);
                } catch (e: unknown) {
                    // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
                    alert((e as Error).message);
                }
            });
        } catch (e: unknown) {
            container.innerHTML = `<div class="admin-empty">Ошибка: ${this.#esc((e as Error).message)}</div>`;
        }
    }

    /**
     * Универсальный рендерер бейджа из словаря (ISSUE_STATUS_BADGES или
     * ISSUE_CATEGORY_BADGES). Неизвестный ключ показывается как есть, без
     * CSS-класса.
     * @param badges - словарь {ключ: {cls, label}}
     * @param key - ключ для поиска в словаре
     * @returns HTML-строка span'а с классом и текстом бейджа
     */
    #issueBadge(badges: Record<string, { cls: string; label: string }>, key: string): string {
        const b = (badges[key] as { cls: string; label: string } | undefined) ?? {
            cls: '',
            label: key
        };
        return `<span class="admin-badge ${b.cls}">${b.label}</span>`;
    }

    /**
     * Очищает root. Виджеты ContextMenu/Modal/FeedbackModal — singleton'ы
     * с собственным lifecycle, их явно демонтировать не требуется.
     */
    public destroy(): void {
        this.#root.innerHTML = '';
    }
}
