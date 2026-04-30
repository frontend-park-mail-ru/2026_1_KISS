import { escapeHtml } from '../../shared/utils/escapeHtml.js';

interface Collaborator {
    id: number;
    label: string;
    permission_level: string;
}

function levelSelect(userId: string, currentLevel: string): string {
    const readonlySelected = currentLevel === 'readonly' ? 'selected' : '';
    const editorSelected = currentLevel === 'editor' ? 'selected' : '';
    return `<select class="share-modal__collaborator-level" data-user-id="${userId}" title="Уровень доступа">
            <option value="readonly" ${readonlySelected}>Просмотр</option>
            <option value="editor" ${editorSelected}>Редактор</option>
        </select>`;
}

export function ShareModalTemplate({ isPublic = false, collaborators = [] }: { isPublic?: boolean; collaborators?: Collaborator[] }): string {
    const collaboratorItems = collaborators
        .map(
            (c) => `
        <div class="share-modal__collaborator" data-user-id="${escapeHtml(String(c.id))}">
            <span class="share-modal__collaborator-email">${escapeHtml(c.label)}</span>
            ${levelSelect(escapeHtml(String(c.id)), c.permission_level)}
            <button class="share-modal__remove-btn" title="Убрать доступ" data-user-id="${escapeHtml(String(c.id))}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>`
        )
        .join('');

    return `<div class="share-modal__overlay">
    <div class="share-modal" role="dialog" aria-modal="true" aria-label="Настройки доступа">
        <div class="share-modal__header">
            <h3 class="share-modal__title">Настройки доступа</h3>
            <button class="share-modal__close-btn" title="Закрыть">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div class="share-modal__body">
            <div class="share-modal__section">
                <label class="share-modal__label">Добавить пользователя по email</label>
                <div class="share-modal__input-row">
                    <input class="share-modal__input" type="email" placeholder="example@mail.com" autocomplete="off" />
                    <button class="share-modal__add-btn">Добавить</button>
                </div>
                <div class="share-modal__error" hidden></div>
            </div>
            <div class="share-modal__section share-modal__section--list">
                ${
                    collaborators.length > 0
                        ? `<div class="share-modal__collaborators">${collaboratorItems}</div>`
                        : `<p class="share-modal__empty">Нет пользователей с доступом</p>`
                }
            </div>
            <div class="share-modal__section share-modal__section--public">
                <div class="share-modal__public-row">
                    <div class="share-modal__public-info">
                        <span class="share-modal__public-label">Публичный доступ</span>
                        <span class="share-modal__public-hint">Любой сможет просматривать по ссылке</span>
                    </div>
                    <label class="share-modal__toggle">
                        <input class="share-modal__toggle-input" type="checkbox" ${isPublic ? 'checked' : ''} />
                        <span class="share-modal__toggle-track">
                            <span class="share-modal__toggle-thumb"></span>
                        </span>
                    </label>
                </div>
            </div>
        </div>
        <div class="share-modal__footer">
            <button class="share-modal__copy-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Копировать ссылку
            </button>
        </div>
    </div>
</div>`;
}
