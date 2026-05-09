import type { Comment } from '../../types.js';

/**
 * Рендерит каркас ветки комментариев: контейнер списка и форму ввода
 * (изначально hidden — видимость управляется через canComment в компоненте).
 * @returns HTML-разметка для innerHTML
 */
export function CommentThreadTemplate(): string {
    return `<div class="comment-thread">
        <div class="comment-thread__list">
            <form class="comment-thread__form" hidden>
                <div class="comment-thread__input-wrapper">
                    <textarea
                        class="comment-thread__textarea"
                        placeholder="Оставьте комментарий..."
                        rows="2"
                        maxlength="2000"
                    ></textarea>
                    <button type="submit" class="comment-thread__submit" title="Отправить">➤</button>
                </div>
            </form>
        </div>
    </div>`;
}

/**
 * Локальный HTML-эскейп через DOM API. Дублирует логику escapeHtml.ts чтобы
 * не тащить зависимость в шаблон.
 * @param text - текст для эскейпа
 * @returns HTML-безопасная строка
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Рендерит один комментарий: автор, время отправки, текст, опционально кнопку
 * удаления. Время форматируется как "HH:MM".
 * @param comment - объект комментария от сервера
 * @param canDelete - показывать ли кнопку удаления (свой комментарий или owner)
 * @returns HTML-разметка одного элемента ветки
 */
export function CommentItemTemplate(comment: Comment, canDelete: boolean): string {
    const date = new Date(comment.created_at);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="comment-thread__item" data-comment-id="${String(comment.id)}">
        <div class="comment-thread__header">
            <span class="comment-thread__author">${escapeHtml(comment.username)}</span>
            <span class="comment-thread__time">${time}</span>
            ${canDelete ? `<button class="comment-thread__delete" data-comment-id="${String(comment.id)}" title="Удалить">&times;</button>` : ''}
        </div>
        <div class="comment-thread__text">${escapeHtml(comment.text)}</div>
    </div>`;
}
