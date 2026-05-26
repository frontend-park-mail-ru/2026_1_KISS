/**
 * Описание одного бейджа для статусов/тарифов: CSS-модификатор и подпись.
 */
export interface BadgeDescriptor {
    /** CSS-класс модификатор (например 'admin-badge--pro') */
    cls: string;
    /** Текст бейджа */
    label: string;
}

/**
 * Маппинг тарифов на бейджи. Используется во всех admin-таблицах.
 */
export const PLAN_BADGES: Record<string, BadgeDescriptor> = {
    starter: { cls: 'admin-badge--free', label: 'Starter' },
    developer: { cls: 'admin-badge--pro', label: 'Developer' },
    professional: { cls: 'admin-badge--max', label: 'Professional' },
    freeze: { cls: 'admin-badge--freeze', label: 'Freeze' },
    admin: { cls: 'admin-badge--admin', label: 'Admin' },
    free: { cls: 'admin-badge--free', label: 'Starter' },
    pro: { cls: 'admin-badge--pro', label: 'Developer' },
    max: { cls: 'admin-badge--max', label: 'Professional' }
};

/**
 * Опции тарифов для select-полей в форме изменения плана. Используются
 * канонические значения; legacy ('free'/'pro'/'max') нормализуются бэкендом
 * через domain.NormalizePlan при записи.
 */
export const PLAN_OPTIONS = [
    { value: 'starter', label: 'Starter' },
    { value: 'developer', label: 'Developer' },
    { value: 'professional', label: 'Professional' },
    { value: 'admin', label: 'Admin' }
];

/**
 * Маппинг статусов issue на бейджи.
 */
export const ISSUE_STATUS_BADGES: Record<string, BadgeDescriptor> = {
    open: { cls: 'admin-badge--active', label: 'Новое' },
    new: { cls: 'admin-badge--active', label: 'Новое' },
    in_progress: { cls: 'admin-badge--pro', label: 'В работе' },
    resolved: { cls: 'admin-badge--free', label: 'Решено' },
    closed: { cls: 'admin-badge--freeze', label: 'Закрыто' }
};

/**
 * Маппинг категорий issue на бейджи.
 */
export const ISSUE_CATEGORY_BADGES: Record<string, BadgeDescriptor> = {
    bug: { cls: 'admin-badge--banned', label: 'Ошибка' },
    idea: { cls: 'admin-badge--pro', label: 'Предложение' },
    problem: { cls: 'admin-badge--freeze', label: 'Проблема' },
    feedback: { cls: 'admin-badge--active', label: 'Общее мнение' }
};

/**
 * Опции статусов для select-полей в форме изменения статуса issue.
 */
export const ISSUE_STATUS_OPTIONS = [
    { value: 'open', label: 'Новое' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'resolved', label: 'Решено' },
    { value: 'closed', label: 'Закрыто' }
];

/**
 * Возвращает HTML-разметку бейджа тарифа из PLAN_BADGES. Неизвестный
 * тариф fallback'ит на 'free'.
 * @param plan - идентификатор тарифа (free/freeze/pro/max/admin)
 * @returns HTML-строка span'а с классом и текстом бейджа
 */
export function planBadge(plan: string): string {
    const b = (PLAN_BADGES[plan] as BadgeDescriptor | undefined) ?? PLAN_BADGES.free;
    return `<span class="admin-badge ${b.cls}">${b.label}</span>`;
}

/**
 * Выбирает правильное окончание из 3 форм по числу (русская плюрализация:
 * 1 файл / 2 файла / 5 файлов).
 * @param n - количество
 * @param one - окончание для 1 (например '')
 * @param few - окончание для 2-4 (например 'а')
 * @param many - окончание для 5+ (например 'ов')
 * @returns одно из переданных окончаний по правилу русской грамматики
 */
export function plural(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
}

/**
 * Форматирует дату в относительный человекочитаемый вид.
 * @param dateStr - ISO-строка даты или пустая строка
 * @returns строка для отображения в UI
 */
export function formatRelativeTime(dateStr: string): string {
    if (dateStr === '') return '—';
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
 * Форматирует общее время в секундах в "N ч. M мин." (или "M мин." при <1ч).
 * @param seconds - длительность в секундах
 * @returns человекочитаемая строка длительности
 */
export function formatDuration(seconds: number): string {
    if (seconds <= 0) return '0 мин.';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${String(hrs)} ч. ${String(mins)} мин.`;
    return `${String(mins)} мин.`;
}

/**
 * Рендерит компактный пагинатор: кнопка "<", до 5 страниц вокруг текущей
 * (current ± 2), кнопка ">". Активная страница выделена CSS-модификатором.
 * @param container - DOM-элемент, в который добавлять пагинатор
 * @param current - текущая страница (1-based)
 * @param total - общее количество страниц
 * @param onPage - колбэк при клике на номер страницы
 */
export function renderPagination(
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
