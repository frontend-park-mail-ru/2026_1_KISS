import { escapeHtml } from '../../shared/utils/escapeHtml.js';

/**
 * Одна запись приглашённого пользователя в UI модалки файла.
 */
interface FileCollaborator {
    /** ID пользователя */
    id: number;
    /** Видимая подпись (email или fallback) */
    label: string;
    /** Уровень доступа: 'view' / 'download' */
    permission_level: string;
}

/**
 * Рендерит select уровня доступа для одного приглашённого.
 * @param userId - ID пользователя (попадёт в data-user-id)
 * @param currentLevel - текущий уровень
 * @returns HTML-разметка select'а
 */
function levelSelect(userId: string, currentLevel: string): string {
    const view = currentLevel === 'view' ? 'selected' : '';
    const dl = currentLevel === 'download' ? 'selected' : '';
    return `<select class="file-share-modal__collaborator-level" data-user-id="${userId}" title="Уровень доступа">
            <option value="view" ${view}>Просмотр</option>
            <option value="download" ${dl}>Скачивание</option>
        </select>`;
}

/**
 * Опции рендера модалки шаринга файла.
 */
export interface FileShareModalTemplateOptions {
    /** Имя файла для заголовка */
    filename: string;
    /** Включён ли публичный доступ */
    isPublic: boolean;
    /** Полный URL публичной ссылки или null */
    publicUrl: string | null;
    /** Выбранный срок жизни: '24h' / '7d' / '30d' / 'forever' */
    selectedLifetime: string;
    /** Список приглашённых */
    collaborators: FileCollaborator[];
}

/**
 * Рендерит модалку настроек доступа к файлу: тоггл публичного доступа,
 * выбор срока жизни ссылки, копирование URL, список приглашённых по email
 * с возможностью менять уровень view/download, форма приглашения.
 * @param options - данные для отображения
 * @returns HTML-разметка для innerHTML
 */
export function FileShareModalTemplate(options: FileShareModalTemplateOptions): string {
    const { filename, isPublic, publicUrl, selectedLifetime, collaborators } = options;

    const collaboratorItems = collaborators
        .map(
            (c) => `
        <div class="file-share-modal__collaborator" data-user-id="${escapeHtml(String(c.id))}">
            <span class="file-share-modal__collaborator-email">${escapeHtml(c.label)}</span>
            ${levelSelect(escapeHtml(String(c.id)), c.permission_level)}
            <button class="file-share-modal__remove-btn" title="Убрать доступ" data-user-id="${escapeHtml(String(c.id))}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>`
        )
        .join('');

    const lifetimes: { value: string; label: string }[] = [
        { value: '24h', label: '24 часа' },
        { value: '7d', label: '7 дней' },
        { value: '30d', label: '30 дней' },
        { value: 'forever', label: 'Без ограничений' }
    ];
    const lifetimeRadios = lifetimes
        .map(
            (l) =>
                `<label class="file-share-modal__lifetime-option">
                    <input type="radio" name="file-share-lifetime" value="${l.value}" ${l.value === selectedLifetime ? 'checked' : ''} />
                    <span>${l.label}</span>
                </label>`
        )
        .join('');

    const linkValue = publicUrl ?? '';
    const linkDisabled = isPublic ? '' : 'disabled';

    return `<div class="file-share-modal__overlay">
    <div class="file-share-modal" role="dialog" aria-modal="true" aria-label="Настройки доступа к файлу">
        <div class="file-share-modal__header">
            <h3 class="file-share-modal__title">Поделиться файлом «${escapeHtml(filename)}»</h3>
            <button class="file-share-modal__close-btn" title="Закрыть">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div class="file-share-modal__body">
            <div class="file-share-modal__section file-share-modal__section--public">
                <div class="file-share-modal__public-row">
                    <div class="file-share-modal__public-info">
                        <span class="file-share-modal__public-label">Публичная ссылка</span>
                        <span class="file-share-modal__public-hint">Любой с этой ссылкой сможет скачать</span>
                    </div>
                    <label class="file-share-modal__toggle">
                        <input class="file-share-modal__toggle-input" type="checkbox" ${isPublic ? 'checked' : ''} />
                        <span class="file-share-modal__toggle-track">
                            <span class="file-share-modal__toggle-thumb"></span>
                        </span>
                    </label>
                </div>
                <div class="file-share-modal__lifetime" ${isPublic ? '' : 'hidden'}>
                    <span class="file-share-modal__lifetime-label">Срок действия</span>
                    <div class="file-share-modal__lifetime-options">${lifetimeRadios}</div>
                </div>
                <div class="file-share-modal__link-row" ${isPublic ? '' : 'hidden'}>
                    <input class="file-share-modal__link-input" type="text" readonly value="${escapeHtml(linkValue)}" ${linkDisabled} />
                    <button class="file-share-modal__copy-btn" ${linkDisabled}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Скопировать
                    </button>
                </div>
            </div>
            <div class="file-share-modal__section">
                <label class="file-share-modal__label">Пригласить пользователя по email</label>
                <div class="file-share-modal__input-row">
                    <input class="file-share-modal__input" type="email" placeholder="example@mail.com" autocomplete="off" />
                    <select class="file-share-modal__level-select" title="Уровень доступа">
                        <option value="download">Скачивание</option>
                        <option value="view">Просмотр</option>
                    </select>
                    <button class="file-share-modal__add-btn">Добавить</button>
                </div>
                <div class="file-share-modal__error" hidden></div>
            </div>
            <div class="file-share-modal__section file-share-modal__section--list">
                ${
                    collaborators.length > 0
                        ? `<div class="file-share-modal__collaborators">${collaboratorItems}</div>`
                        : `<p class="file-share-modal__empty">Нет пользователей с доступом</p>`
                }
            </div>
        </div>
    </div>
</div>`;
}
