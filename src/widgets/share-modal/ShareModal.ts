import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { ShareModalTemplate } from './ShareModal.template.js';
import { nn } from '../../shared/utils/notNull.js';

interface Collaborator {
    id: number;
    label: string;
    permission_level: string;
}

export class ShareModal extends BaseComponent {
    #notebookId: string | number | null = null;
    #notebookTitle = '';
    #http: HttpClient;
    #isPublic = false;
    #collaborators: Collaborator[] = [];

    public constructor() {
        super(null, document.body);
        this.#http = HttpClient.getInstance();
    }

    public async open(
        notebookId: string | number,
        notebookTitle: string,
        isPublic: boolean
    ): Promise<void> {
        this.#notebookId = notebookId;
        this.#notebookTitle = notebookTitle;
        this.#isPublic = isPublic;
        this.#collaborators = [];

        await this.#fetchPermissions();
        this.#buildElement();
        super.mount();
        document.body.style.overflow = 'hidden';
        (this._element.querySelector('.share-modal__input'))?.focus();
    }

    public close(): void {
        if (!this._isMounted) return;
        super.unmount();
        document.body.style.overflow = '';
    }

    public mount(): void { /* noop */ }

    public unmount(): void {
        this.close();
    }

    async #fetchPermissions(): Promise<void> {
        try {
            const res = await this.#http.get(`/notebooks/${this.#notebookId}/permissions`, {
                noCache: true
            });
            if (res.ok) {
                const { data } = await res.json();
                this.#collaborators = (data.permissions ?? []).map(
                    (p: { user_id: number; email?: string; permission_level: string }) => ({
                        id: p.user_id,
                        label: p.email ?? `Пользователь #${p.user_id}`,
                        permission_level: p.permission_level
                    })
                );
            }
        } catch {
            /* empty */
        }
    }

    #buildElement(): void {
        const tmp = document.createElement('div');
        tmp.innerHTML = ShareModalTemplate({
            isPublic: this.#isPublic,
            collaborators: this.#collaborators
        });
        this._element = tmp.firstElementChild as HTMLElement;
        this.#attachEvents();
    }

    #attachEvents(): void {
        this._addListener(
            this._element.querySelector('.share-modal__overlay'),
            'click',
            (e: Event) => {
                if (e.target === e.currentTarget) this.close();
            }
        );
        this._addListener(this._element.querySelector('.share-modal__close-btn'), 'click', () => {
            this.close();
        });
        this._addListener(document, 'keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Escape') this.close();
        });

        const input = nn(this._element.querySelector('.share-modal__input'));
        const addBtn = nn(this._element.querySelector('.share-modal__add-btn'));
        this._addListener(addBtn, 'click', () => this.#handleAdd(input));
        this._addListener(input, 'keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Enter') this.#handleAdd(input);
        });

        const list = this._element.querySelector('.share-modal__collaborators');
        if (list) {
            this._addListener(list, 'click', (e: Event) => {
                const btn = (e.target as HTMLElement).closest(
                    '.share-modal__remove-btn'
                );
                if (btn) this.#handleRemove(btn.dataset.userId);
            });
            this._addListener(list, 'change', (e: Event) => {
                const sel = (e.target as HTMLElement).closest(
                    '.share-modal__collaborator-level'
                );
                if (sel) this.#handleLevelChange(sel.dataset.userId, sel.value);
            });
        }

        const toggle = nn(this._element.querySelector(
            '.share-modal__toggle-input'
        ));
        this._addListener(toggle, 'change', () => this.#handlePublicToggle(toggle.checked));

        this._addListener(this._element.querySelector('.share-modal__copy-btn'), 'click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.#showCopyFeedback();
            });
        });
    }

    async #handleAdd(input: HTMLInputElement): Promise<void> {
        const email = input.value.trim();
        if (!email) return;

        if (!this.#isValidEmail(email)) {
            this.#showError('Введите корректный email');
            return;
        }

        if (this.#collaborators.some((c) => c.label.toLowerCase() === email.toLowerCase())) {
            this.#showError('Пользователь уже имеет доступ');
            return;
        }

        const addBtn = nn(this._element.querySelector('.share-modal__add-btn'));
        addBtn.disabled = true;
        this.#clearError();

        try {
            const level = 'readonly';

            const res = await this.#http.post(`/notebooks/${this.#notebookId}/permissions/invite`, {
                identifier: email,
                level
            });

            if (res.ok) {
                const { data } = await res.json();
                this.#collaborators.push({
                    id: data.user_id,
                    label: email,
                    permission_level: data.permission_level
                });
                input.value = '';
                this.#rerenderList();
            } else if (res.status === 404) {
                this.#showError('Пользователь не найден');
            } else {
                const body = await res.json().catch(() => ({}));
                this.#showError(body.error ?? 'Не удалось добавить пользователя');
            }
        } catch {
            this.#showError('Ошибка соединения');
        } finally {
            addBtn.disabled = false;
        }
    }

    async #handleRemove(userId: string): Promise<void> {
        try {
            const res = await this.#http.delete(
                `/notebooks/${this.#notebookId}/permissions/${userId}`
            );
            if (res.ok || res.status === 204) {
                this.#collaborators = this.#collaborators.filter(
                    (c) => String(c.id) !== userId
                );
                this.#rerenderList();
            }
        } catch {
            /* ignore */
        }
    }

    async #handleLevelChange(userId: string, level: string): Promise<void> {
        const collaborator = this.#collaborators.find((c) => String(c.id) === userId);
        if (!collaborator) return;

        const prev = collaborator.permission_level;
        collaborator.permission_level = level;

        try {
            const res = await this.#http.put(
                `/notebooks/${this.#notebookId}/permissions/${userId}`,
                { level }
            );
            if (!res.ok) {
                collaborator.permission_level = prev;
                this.#rerenderList();
            }
        } catch {
            collaborator.permission_level = prev;
            this.#rerenderList();
        }
    }

    async #handlePublicToggle(checked: boolean): Promise<void> {
        const prev = this.#isPublic;
        this.#isPublic = checked;

        try {
            const res = await this.#http.put(`/notebooks/${this.#notebookId}`, {
                title: this.#notebookTitle,
                is_public: checked
            });
            if (!res.ok) {
                this.#isPublic = prev;
                const toggle = this._element.querySelector(
                    '.share-modal__toggle-input'
                );
                if (toggle) toggle.checked = prev;
            }
        } catch {
            this.#isPublic = prev;
            const toggle = this._element.querySelector(
                '.share-modal__toggle-input'
            );
            if (toggle) toggle.checked = prev;
        }
    }

    #rerenderList(): void {
        const section = this._element.querySelector('.share-modal__section--list');
        if (!section) return;

        if (this.#collaborators.length === 0) {
            section.innerHTML = '<p class="share-modal__empty">Нет пользователей с доступом</p>';
            return;
        }
        const items = this.#collaborators
            .map(
                (c) => `
            <div class="share-modal__collaborator" data-user-id="${c.id}">
                <span class="share-modal__collaborator-email">${this.#escape(c.label)}</span>
                <select class="share-modal__collaborator-level" data-user-id="${c.id}" title="Уровень доступа">
                    <option value="readonly" ${c.permission_level === 'readonly' ? 'selected' : ''}>Просмотр</option>
                    <option value="editor" ${c.permission_level === 'editor' ? 'selected' : ''}>Редактор</option>
                </select>
                <button class="share-modal__remove-btn" title="Убрать доступ" data-user-id="${c.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>`
            )
            .join('');
        section.innerHTML = `<div class="share-modal__collaborators">${items}</div>`;

        const list = section.querySelector('.share-modal__collaborators');
        if (list) {
            this._addListener(list, 'click', (e: Event) => {
                const btn = (e.target as HTMLElement).closest(
                    '.share-modal__remove-btn'
                );
                if (btn) this.#handleRemove(btn.dataset.userId);
            });
            this._addListener(list, 'change', (e: Event) => {
                const sel = (e.target as HTMLElement).closest(
                    '.share-modal__collaborator-level'
                );
                if (sel) this.#handleLevelChange(sel.dataset.userId, sel.value);
            });
        }
    }

    #showError(msg: string): void {
        const el = this._element.querySelector('.share-modal__error');
        if (!el) return;
        el.textContent = msg;
        el.hidden = false;
    }

    #clearError(): void {
        const el = this._element.querySelector('.share-modal__error');
        if (el) el.hidden = true;
    }

    #showCopyFeedback(): void {
        const btn = this._element.querySelector('.share-modal__copy-btn');
        if (!btn) return;
        const original = btn.innerHTML;
        btn.textContent = 'Скопировано!';
        btn.classList.add('share-modal__copy-btn--success');
        setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('share-modal__copy-btn--success');
        }, 2000);
    }

    #isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    #escape(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
