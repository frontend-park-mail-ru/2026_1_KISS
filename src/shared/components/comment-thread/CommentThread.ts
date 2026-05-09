import { BaseComponent } from '../base-component/BaseComponent.js';
import { CommentThreadTemplate, CommentItemTemplate } from './CommentThread.template.js';
import type { Comment } from '../../types.js';
import type { NotebookApi } from '../../api/NotebookApi.js';
import { nn } from '../../utils/notNull.js';
import { logError } from '../../utils/logger.js';

/**
 * Опции конструктора CommentThread: контекст блока и API-клиент.
 */
export interface CommentThreadOptions {
    /** ID notebook'а в котором находится блок */
    notebookId: number | string;
    /** ID блока к которому привязана ветка комментариев */
    blockId: number | string;
    /** ID текущего пользователя — для определения "своих" комментариев */
    currentUserId: number;
    /** true если текущий пользователь — владелец notebook'а (может удалять чужие) */
    isOwner: boolean;
    /** Имеет ли пользователь право добавлять комментарии (показывает форму) */
    canComment: boolean;
    /** API-клиент для работы с комментариями */
    api: NotebookApi;
}

/**
 * Ветка комментариев для одного блока notebook'а. Подгружает комментарии при mount,
 * показывает форму ввода (если canComment) и кнопку удаления у "своих" комментариев
 * (или у всех — если пользователь владелец). Поддерживает Ctrl+Enter для отправки.
 */
export class CommentThread extends BaseComponent {
    #notebookId: number | string;
    #blockId: number | string;
    #currentUserId: number;
    #isOwner: boolean;
    #canComment: boolean;
    #api: NotebookApi;
    #comments: Comment[] = [];

    /**
     * Создаёт ветку комментариев. Загрузка комментариев откладывается до mount().
     * @param parent - родительский элемент
     * @param options - контекст блока и API (см. CommentThreadOptions)
     */
    public constructor(
        parent: HTMLElement,
        { notebookId, blockId, currentUserId, isOwner, canComment, api }: CommentThreadOptions
    ) {
        super(null, parent);
        this.#notebookId = notebookId;
        this.#blockId = blockId;
        this.#currentUserId = currentUserId;
        this.#isOwner = isOwner;
        this.#canComment = canComment;
        this.#api = api;
        this.#render();
    }

    /**
     * Рендерит каркас компонента (без комментариев — они подгружаются в mount).
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = CommentThreadTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит компонент, навешивает обработчики и асинхронно подгружает комментарии.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
        void this.#loadComments();
    }

    /**
     * Снимает компонент с DOM. Слушатели снимаются автоматически.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Навешивает: submit формы (с очисткой и appendComment), input для авто-resize
     * textarea, Ctrl+Enter для отправки, click для удаления комментариев.
     */
    #attachEvents(): void {
        const form = nn(this._element.querySelector<HTMLFormElement>('.comment-thread__form'));
        const textarea = nn(form.querySelector<HTMLTextAreaElement>('.comment-thread__textarea'));

        if (this.#canComment) {
            form.hidden = false;
        }

        const autoResize = (): void => {
            textarea.style.height = 'auto';
            textarea.style.height = `${String(textarea.scrollHeight)}px`;
        };

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this._addListener(form, 'submit', async (e: Event) => {
            e.preventDefault();
            const text = textarea.value.trim();
            if (!text) return;

            try {
                const comment = await this.#api.addComment(this.#notebookId, this.#blockId, text);
                // eslint-disable-next-line require-atomic-updates -- DOM element is captured locally; UI is single-threaded
                textarea.value = '';
                // eslint-disable-next-line require-atomic-updates -- DOM element is captured locally; UI is single-threaded
                textarea.style.height = '';
                this.appendComment(comment);
            } catch (err: unknown) {
                logError('Failed to add comment:', err);
            }
        });

        this._addListener(textarea, 'input', autoResize);

        this._addListener(textarea, 'keydown', (e: unknown) => {
            if ((e as KeyboardEvent).key === 'Enter' && (e as KeyboardEvent).ctrlKey) {
                form.requestSubmit();
            }
        });

        this._addListener(this._element, 'click', (e: unknown) => {
            const target = (e as MouseEvent).target as HTMLElement;
            const deleteBtn = target.closest<HTMLElement>('.comment-thread__delete');
            if (deleteBtn) {
                const commentId = deleteBtn.dataset.commentId;
                if (commentId !== undefined) void this.#deleteComment(Number(commentId));
            }
        });
    }

    /**
     * Подгружает комментарии с сервера и рендерит их. Ошибки логирует, но
     * не падает — UI просто остаётся пустым.
     */
    async #loadComments(): Promise<void> {
        try {
            const comments = await this.#api.getComments(this.#notebookId, this.#blockId);
            this.#comments = comments;
            this.#renderComments();
        } catch (err: unknown) {
            logError('Failed to load comments:', err);
        }
    }

    /**
     * Перерисовывает все комментарии в списке. Сохраняет форму ввода в конце
     * (она встроена в .comment-thread__list для удобства layout'а).
     */
    #renderComments(): void {
        const list = nn(this._element.querySelector('.comment-thread__list'));
        const form = list.querySelector('.comment-thread__form');
        list.innerHTML = this.#comments
            .map((c) => CommentItemTemplate(c, c.user_id === this.#currentUserId || this.#isOwner))
            .join('');
        if (form) list.appendChild(form);
    }

    /**
     * Запрашивает удаление комментария через API и (при успехе) убирает его из UI.
     * @param commentId - идентификатор удаляемого комментария
     */
    async #deleteComment(commentId: number): Promise<void> {
        try {
            await this.#api.deleteComment(this.#notebookId, this.#blockId, commentId);
            this.removeComment(commentId);
        } catch (err: unknown) {
            logError('Failed to delete comment:', err);
        }
    }

    /**
     * Добавляет новый комментарий в список — без перерисовки всех остальных.
     * Используется как при отправке нового, так и при получении real-time updates.
     * @param comment - объект комментария от сервера
     */
    public appendComment(comment: Comment): void {
        this.#comments.push(comment);
        const list = nn(this._element.querySelector('.comment-thread__list'));
        const form = list.querySelector('.comment-thread__form');
        const html = CommentItemTemplate(
            comment,
            comment.user_id === this.#currentUserId || this.#isOwner
        );
        if (form) {
            form.insertAdjacentHTML('beforebegin', html);
        } else {
            list.insertAdjacentHTML('beforeend', html);
        }
    }

    /**
     * Удаляет комментарий из локального состояния и DOM. Используется как
     * при ответе на API-удаление, так и при real-time updates.
     * @param commentId - идентификатор удаляемого комментария
     */
    public removeComment(commentId: number): void {
        this.#comments = this.#comments.filter((c) => c.id !== commentId);
        const el = this._element.querySelector(
            `.comment-thread__item[data-comment-id="${String(commentId)}"]`
        );
        if (el) el.remove();
    }

    /**
     * Проверяет наличие хотя бы одного комментария — используется родителями
     * для показа индикатора "есть обсуждение" рядом с блоком.
     * @returns true если комментариев больше нуля
     */
    public hasComments(): boolean {
        return this.#comments.length > 0;
    }
}
