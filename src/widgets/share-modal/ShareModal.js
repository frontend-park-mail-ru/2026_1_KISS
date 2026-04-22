import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { ShareModalTemplate } from './ShareModal.template.js';

/**
 * Модальное окно настройки доступа к ноутбуку.
 * Монтируется на document.body, открывается через open(), закрывается через close().
 *
 * API endpoints:
 *   GET    /notebooks/{id}/permissions          → список пользователей с доступом
 *   POST   /notebooks/{id}/permissions/invite   → { identifier, level } — пригласить по email
 *   DELETE /notebooks/{id}/permissions/{userId} → 204 — убрать доступ
 *   PUT    /notebooks/{id}                      → { title, is_public } — публичный доступ
 */
export class ShareModal extends BaseComponent {
    /** @type {string|number} */
    #notebookId = null;

    /** @type {string} */
    #notebookTitle = '';

    /** @type {HttpClient} */
    #http;

    /** @type {boolean} */
    #isPublic = false;

    /**
     * Локальный список коллабораторов: { id, label, permission_level }
     * label — email (при добавлении) или "Пользователь #{id}" (при загрузке из API)
     * @type {Array<{id: number, label: string, permission_level: string}>}
     */
    #collaborators = [];

    constructor() {
        super(null, document.body);
        this.#http = HttpClient.getInstance();
    }

    /**
     * Открыть модалку для конкретного ноутбука.
     * @param {string|number} notebookId
     * @param {string} notebookTitle  — текущее название (нужно для PUT /notebooks/{id})
     * @param {boolean} isPublic      — текущее значение is_public
     */
    async open(notebookId, notebookTitle, isPublic) {
        this.#notebookId = notebookId;
        this.#notebookTitle = notebookTitle;
        this.#isPublic = isPublic;
        this.#collaborators = [];

        await this.#fetchPermissions();
        this.#buildElement();
        super.mount();
        document.body.style.overflow = 'hidden';
        this._element.querySelector('.share-modal__input')?.focus();
    }

    close() {
        if (!this._isMounted) return;
        super.unmount();
        document.body.style.overflow = '';
    }

    mount() {
        // Используется только через open()
    }

    unmount() {
        this.close();
    }

    /** @private */
    async #fetchPermissions() {
        try {
            const res = await this.#http.get(`/notebooks/${this.#notebookId}/permissions`);
            if (res.ok) {
                const { data } = await res.json();
                this.#collaborators = (data.permissions ?? []).map((p) => ({
                    id: p.user_id,
                    label: p.email || `Пользователь #${p.user_id}`,
                    permission_level: p.permission_level
                }));
            }
        } catch {
            /* Стартуем с пустым состоянием */
        }
    }

    /** @private */
    #buildElement() {
        const tmp = document.createElement('div');
        tmp.innerHTML = ShareModalTemplate({
            isPublic: this.#isPublic,
            collaborators: this.#collaborators
        });
        this._element = tmp.firstElementChild;
        this.#attachEvents();
    }

    /** @private */
    #attachEvents() {
        this._addListener(this._element.querySelector('.share-modal__overlay'), 'click', (e) => {
            if (e.target === e.currentTarget) this.close();
        });
        this._addListener(this._element.querySelector('.share-modal__close-btn'), 'click', () => {
            this.close();
        });
        this._addListener(document, 'keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });

        const input = this._element.querySelector('.share-modal__input');
        const addBtn = this._element.querySelector('.share-modal__add-btn');
        this._addListener(addBtn, 'click', () => this.#handleAdd(input));
        this._addListener(input, 'keydown', (e) => {
            if (e.key === 'Enter') this.#handleAdd(input);
        });

        const list = this._element.querySelector('.share-modal__collaborators');
        if (list) {
            this._addListener(list, 'click', (e) => {
                const btn = e.target.closest('.share-modal__remove-btn');
                if (btn) this.#handleRemove(btn.dataset.userId);
            });
            this._addListener(list, 'change', (e) => {
                const sel = e.target.closest('.share-modal__collaborator-level');
                if (sel) this.#handleLevelChange(sel.dataset.userId, sel.value);
            });
        }

        const toggle = this._element.querySelector('.share-modal__toggle-input');
        this._addListener(toggle, 'change', () => this.#handlePublicToggle(toggle.checked));

        this._addListener(this._element.querySelector('.share-modal__copy-btn'), 'click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.#showCopyFeedback();
            });
        });
    }

    /** @private */
    async #handleAdd(input) {
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

        const addBtn = this._element.querySelector('.share-modal__add-btn');
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
                this.#showError(body.error || 'Не удалось добавить пользователя');
            }
        } catch {
            this.#showError('Ошибка соединения');
        } finally {
            addBtn.disabled = false;
        }
    }

    /** @private */
    async #handleRemove(userId) {
        try {
            const res = await this.#http.delete(
                `/notebooks/${this.#notebookId}/permissions/${userId}`
            );
            // 204 No Content — успех
            if (res.ok || res.status === 204) {
                this.#collaborators = this.#collaborators.filter(
                    (c) => String(c.id) !== String(userId)
                );
                this.#rerenderList();
            }
        } catch {
            /* ignore */
        }
    }

    /** @private */
    async #handleLevelChange(userId, level) {
        const collaborator = this.#collaborators.find((c) => String(c.id) === String(userId));
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

    /** @private */
    async #handlePublicToggle(checked) {
        const prev = this.#isPublic;
        this.#isPublic = checked;

        try {
            const res = await this.#http.put(`/notebooks/${this.#notebookId}`, {
                title: this.#notebookTitle,
                is_public: checked
            });
            if (!res.ok) {
                this.#isPublic = prev;
                const toggle = this._element.querySelector('.share-modal__toggle-input');
                if (toggle) toggle.checked = prev;
            }
        } catch {
            this.#isPublic = prev;
            const toggle = this._element.querySelector('.share-modal__toggle-input');
            if (toggle) toggle.checked = prev;
        }
    }

    /** @private */
    #rerenderList() {
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
            this._addListener(list, 'click', (e) => {
                const btn = e.target.closest('.share-modal__remove-btn');
                if (btn) this.#handleRemove(btn.dataset.userId);
            });
            this._addListener(list, 'change', (e) => {
                const sel = e.target.closest('.share-modal__collaborator-level');
                if (sel) this.#handleLevelChange(sel.dataset.userId, sel.value);
            });
        }
    }

    /** @private */
    #showError(msg) {
        const el = this._element.querySelector('.share-modal__error');
        if (!el) return;
        el.textContent = msg;
        el.hidden = false;
    }

    /** @private */
    #clearError() {
        const el = this._element.querySelector('.share-modal__error');
        if (el) el.hidden = true;
    }

    /** @private */
    #showCopyFeedback() {
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

    /** @private */
    #isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /** @private */
    #escape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
