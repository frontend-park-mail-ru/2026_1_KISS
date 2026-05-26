import { escapeHtml } from '../../shared/utils/escapeHtml.js';

/**
 * Контекст шаблона шапки notebook'а.
 */
interface NotebookHeaderTemplateCtx {
    /** Имя файла notebook'а — отображается в центре */
    filename: string;
    /** true если текущий пользователь — владелец (показывает edit/share кнопки) */
    isOwner: boolean;
    /** Не-undefined если пользователь — админ */
    onAdmin?: unknown;
    /** Данные пользователя для user-pill */
    user?: {
        /** URL аватара */
        avatarUrl?: string;
        /** Инициалы для дефолтного аватара */
        initials: string;
        /** Логин для отображения */
        username: string;
    } | null;
}

/**
 * Рендерит шапку страницы notebook'а: логотип, имя файла с кнопками
 * (rename для владельца, share для владельца, избранное, облако), user-pill
 * с dropdown'ом, menu-bar с File-меню (Открыть/Сохранить/Сохранить как).
 * @param ctx - контекст шаблона
 * @returns HTML-разметка для innerHTML
 */
export function NotebookHeaderTemplate(ctx: NotebookHeaderTemplateCtx): string {
    return `<header class="notebook-header">
    <div class="notebook-header__top">
        <a href="/files" class="notebook-header__logo-link">
            <svg class="notebook-header__logo-icon" width="28" height="28" viewBox="0 0 24 24" fill="var(--teal-green)">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
                <polyline points="14,2 14,8 20,8" fill="none" stroke="var(--white)" stroke-width="1.5"/>
            </svg>
            <span class="notebook-header__logo-text">KissColab</span>
        </a>
        <div class="notebook-header__center">
            <span class="notebook-header__filename">${escapeHtml(ctx.filename)}</span>
            <div class="notebook-header__icons">
                ${
                    ctx.isOwner
                        ? `<button class="notebook-header__icon-btn notebook-header__edit-btn" title="Переименовать">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>`
                        : ''
                }
                <button class="notebook-header__icon-btn" title="Избранное">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
                <button class="notebook-header__icon-btn" title="Облако">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>
                </button>
                ${
                    ctx.isOwner
                        ? `<button class="notebook-header__icon-btn notebook-header__share-btn" title="Поделиться">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </button>`
                        : ''
                }
            </div>
        </div>
        <div class="notebook-header__right">
            ${
                ctx.user
                    ? `<div class="notebook-header__user-pill-wrapper">
                <div class="notebook-header__user-pill">
                    ${(ctx.user.avatarUrl ?? '') !== '' ? `<img class="notebook-header__pill-avatar" src="${escapeHtml(ctx.user.avatarUrl)}" alt="" />` : `<span class="notebook-header__pill-avatar notebook-header__pill-avatar--default">${escapeHtml(ctx.user.initials)}</span>`}
                    <span>${escapeHtml(ctx.user.username)}</span>
                </div>
                <div class="header-user-dropdown notebook-header__user-dropdown">
                    <button class="header-user-dropdown__item" data-action="profile">Профиль</button>
                    ${ctx.onAdmin !== undefined && ctx.onAdmin !== null ? '<button class="header-user-dropdown__item" data-action="admin">Админ-панель</button>' : ''}
                    <button class="header-user-dropdown__item" data-action="feedback">Обратная связь</button>
                    <button class="header-user-dropdown__item header-user-dropdown__item--danger" data-action="logout">Выйти из аккаунта</button>
                </div>
            </div>`
                    : ''
            }
        </div>
    </div>
    <nav class="notebook-header__menu-bar">
        <div class="notebook-header__menu-wrapper">
            <button class="notebook-header__menu-item" data-menu="file">Файл</button>
            <div class="notebook-header__dropdown" data-dropdown-for="file">
                <button class="notebook-header__dropdown-item" data-action="open">Открыть</button>
                <button class="notebook-header__dropdown-item" data-action="save">Сохранить</button>
                <button class="notebook-header__dropdown-item" data-action="save-as">Сохранить как</button>
            </div>
        </div>
        <div class="notebook-header__menu-wrapper">
            <button class="notebook-header__menu-item" data-menu="blocks">Блоки</button>
            <div class="notebook-header__dropdown" data-dropdown-for="blocks">
                <button class="notebook-header__dropdown-item" data-action="add-code">Добавить код</button>
                <button class="notebook-header__dropdown-item" data-action="add-text">Добавить текст</button>
            </div>
        </div>
        <label class="notebook-header__toggle" data-action="toggle-comments">
            <input type="checkbox" class="notebook-header__toggle-input" aria-label="Показать комментарии">
            <span class="notebook-header__toggle-label">Комментарии</span>
        </label>
        <div class="notebook-header__actions">
            <button class="notebook-header__action-btn" data-action="restart" title="Перезапустить контейнер">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
            </button>
            <button class="notebook-header__action-btn" data-action="clear-outputs" title="Очистить все выводы">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
            <button class="notebook-header__action-btn" data-action="interrupt" title="Остановить выполнение">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
            </button>
            <button class="notebook-header__action-btn notebook-header__action-btn--run" data-action="run-all" title="Выполнить все">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
                <span class="notebook-header__action-btn-text">Выполнить все</span>
            </button>
            <span class="notebook-header__queue-badge" data-queue-badge style="display:none">
                В очереди: <strong data-queue-position></strong>
            </span>
        </div>
    </nav>
</header>`;
}
