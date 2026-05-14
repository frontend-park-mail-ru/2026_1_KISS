import { escapeHtml } from '../../shared/utils/escapeHtml.js';

/**
 * Рендерит модалку переименования файла с предзаполненным значением.
 * @param currentName - текущее имя файла
 * @returns HTML-разметка
 */
export function RenameModalTemplate(currentName: string): string {
    return `<div class="rename-modal__overlay">
    <div class="rename-modal" role="dialog" aria-modal="true" aria-label="Переименование файла">
        <div class="rename-modal__header">
            <h3 class="rename-modal__title">Переименовать файл</h3>
            <button class="rename-modal__close-btn" title="Закрыть">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div class="rename-modal__body">
            <label class="rename-modal__label" for="rename-modal-input">Новое имя</label>
            <input id="rename-modal-input" class="rename-modal__input" type="text"
                value="${escapeHtml(currentName)}" maxlength="255" />
            <div class="rename-modal__error" hidden></div>
        </div>
        <div class="rename-modal__footer">
            <button class="rename-modal__cancel-btn">Отмена</button>
            <button class="rename-modal__save-btn">Сохранить</button>
        </div>
    </div>
</div>`;
}
