import { BaseComponent } from '../base-component/BaseComponent.js';
import { CommentThreadTemplate, CommentItemTemplate } from './CommentThread.template.js';
import type { Comment } from '../../types.js';
import type { NotebookApi } from '../../api/NotebookApi.js';

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

    constructor(
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

    mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
        this.#loadComments();
    }

    unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    #attachEvents(): void {
        const form = this._element.querySelector('.comment-thread__form') as HTMLFormElement;
        const textarea = form.querySelector('.comment-thread__textarea') as HTMLTextAreaElement;

        if (this.#canComment) {
            form.hidden = false;
        }

        const autoResize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };

        this._addListener(form, 'submit', async (e: Event) => {
            e.preventDefault();
            const text = textarea.value.trim();
            if (!text) return;

            try {
                const comment = await this.#api.addComment(this.#notebookId, this.#blockId, text);
                textarea.value = '';
                textarea.style.height = '';
                this.appendComment(comment as unknown as Comment);
            } catch (err: unknown) {
                console.error('Failed to add comment:', err);
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
            const deleteBtn = target.closest('.comment-thread__delete') as HTMLElement | null;
            if (deleteBtn) {
                const commentId = deleteBtn.dataset.commentId;
                if (commentId) this.#deleteComment(Number(commentId));
            }
        });
    }

    async #loadComments(): Promise<void> {
        try {
            const comments = await this.#api.getComments(this.#notebookId, this.#blockId);
            this.#comments = comments as unknown as Comment[];
            this.#renderComments();
        } catch (err: unknown) {
            console.error('Failed to load comments:', err);
        }
    }

    #renderComments(): void {
        const list = this._element.querySelector('.comment-thread__list') as HTMLElement;
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
            console.error('Failed to delete comment:', err);
        }
    }

    appendComment(comment: Comment): void {
        this.#comments.push(comment);
        const list = this._element.querySelector('.comment-thread__list') as HTMLElement;
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

    removeComment(commentId: number): void {
        this.#comments = this.#comments.filter((c) => c.id !== commentId);
        const el = this._element.querySelector(
            `.comment-thread__item[data-comment-id="${commentId}"]`
        );
        if (el) el.remove();
    }

    hasComments(): boolean {
        return this.#comments.length > 0;
    }
}
