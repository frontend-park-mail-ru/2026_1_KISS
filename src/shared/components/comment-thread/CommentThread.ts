import { BaseComponent } from '../base-component/BaseComponent.js';
import { CommentThreadTemplate, CommentItemTemplate } from './CommentThread.template.js';
import type { Comment } from '../../types.js';
import type { NotebookApi } from '../../api/NotebookApi.js';
import { nn } from '../../utils/notNull.js';
import { logError } from '../../utils/logger.js';

export interface CommentThreadOptions {
    notebookId: number | string;
    blockId: number | string;
    currentUserId: number;
    isOwner: boolean;
    canComment: boolean;
    api: NotebookApi;
}

export class CommentThread extends BaseComponent {
    #notebookId: number | string;
    #blockId: number | string;
    #currentUserId: number;
    #isOwner: boolean;
    #canComment: boolean;
    #api: NotebookApi;
    #comments: Comment[] = [];

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

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = CommentThreadTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
        void this.#loadComments();
    }

    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    #attachEvents(): void {
        const form = nn(this._element.querySelector<HTMLFormElement>('.comment-thread__form'));
        const textarea = nn(form.querySelector<HTMLTextAreaElement>('.comment-thread__textarea'));

        if (this.#canComment) {
            form.hidden = false;
        }

        const autoResize = (): void => {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
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

    async #loadComments(): Promise<void> {
        try {
            const comments = await this.#api.getComments(this.#notebookId, this.#blockId);
            this.#comments = comments;
            this.#renderComments();
        } catch (err: unknown) {
            logError('Failed to load comments:', err);
        }
    }

    #renderComments(): void {
        const list = nn(this._element.querySelector('.comment-thread__list'));
        const form = list.querySelector('.comment-thread__form');
        list.innerHTML = this.#comments
            .map((c) => CommentItemTemplate(c, c.user_id === this.#currentUserId || this.#isOwner))
            .join('');
        if (form) list.appendChild(form);
    }

    async #deleteComment(commentId: number): Promise<void> {
        try {
            await this.#api.deleteComment(this.#notebookId, this.#blockId, commentId);
            this.removeComment(commentId);
        } catch (err: unknown) {
            logError('Failed to delete comment:', err);
        }
    }

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

    public removeComment(commentId: number): void {
        this.#comments = this.#comments.filter((c) => c.id !== commentId);
        const el = this._element.querySelector(
            `.comment-thread__item[data-comment-id="${commentId}"]`
        );
        if (el) el.remove();
    }

    public hasComments(): boolean {
        return this.#comments.length > 0;
    }
}
