import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { IssueApi } from '../../shared/api/IssueApi.js';

const CATEGORIES = [
    {
        value: 'bug',
        label: 'Bug',
        sublabel: 'Ошибка',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M6 17l-4 1M17.47 9c1.93-.2 3.53-1.9 3.53-4M18 13h4M18 17l4 1"/></svg>'
    },
    {
        value: 'idea',
        label: 'Idea',
        sublabel: 'Предложение',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>'
    },
    {
        value: 'problem',
        label: 'Problem',
        sublabel: 'Проблема',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    },
    {
        value: 'feedback',
        label: 'Feedback',
        sublabel: 'Общее мнение',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'
    }
];

const STATUS_LABELS = {
    new: 'Новое',
    in_progress: 'В работе',
    resolved: 'Решено',
    closed: 'Закрыто'
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 2000;

export class FeedbackModal extends BaseComponent {
    #issueApi;
    #selectedCategory = null;
    #attachedFiles = [];

    constructor() {
        const el = document.createElement('div');
        el.className = 'feedback-modal__overlay';
        super(el, document.body);
        this.#issueApi = new IssueApi();
        this.mount();
    }

    open() {
        this.#selectedCategory = null;
        this.#attachedFiles = [];
        this.#renderForm();
        this._element.classList.add('feedback-modal__overlay--visible');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this._element.classList.remove('feedback-modal__overlay--visible');
        document.body.style.overflow = '';
    }

    #renderForm() {
        this._element.innerHTML = '';
        this._clearListeners();

        const modal = document.createElement('div');
        modal.className = 'feedback-modal';

        modal.innerHTML = `
            <div class="feedback-modal__header">
                <div>
                    <h3 class="feedback-modal__title">Обратная связь</h3>
                    <p class="feedback-modal__subtitle">Помогите нам стать лучше</p>
                </div>
                <button class="feedback-modal__close-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="feedback-modal__body">
                <div class="feedback-modal__field">
                    <label class="feedback-modal__label">Тип обращения <span style="color: var(--error-red)">*</span></label>
                    <div class="feedback-modal__categories">
                        ${CATEGORIES.map(
                            (cat) => `
                            <button class="feedback-modal__category-card" data-category="${cat.value}">
                                ${cat.icon}
                                <span class="feedback-modal__category-label">${cat.label}</span>
                                <span class="feedback-modal__category-sublabel">${cat.sublabel}</span>
                            </button>`
                        ).join('')}
                    </div>
                </div>
                <div class="feedback-modal__field">
                    <label class="feedback-modal__label">Описание <span style="color: var(--error-red)">*</span></label>
                    <textarea class="feedback-modal__textarea" maxlength="${MAX_CONTENT_LENGTH}" placeholder="Расскажите подробнее, что произошло / что можно улучшить...\nЧто вы делали? Что ожидали? Что пошло не так?"></textarea>
                    <span class="feedback-modal__char-count">0 / ${MAX_CONTENT_LENGTH}</span>
                </div>
                <div class="feedback-modal__field">
                    <label class="feedback-modal__label">Приложить файлы <span class="feedback-modal__optional">(необязательно)</span></label>
                    <div class="feedback-modal__dropzone">
                        <input type="file" class="feedback-modal__file-input" multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip" />
                        <div class="feedback-modal__dropzone-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                            </svg>
                        </div>
                        <p class="feedback-modal__dropzone-text">Нажмите или перетащите файл сюда</p>
                        <span class="feedback-modal__dropzone-hint">Поддерживаются изображения и документы до 10 МБ</span>
                    </div>
                    <div class="feedback-modal__file-list"></div>
                </div>
                <div class="feedback-modal__error" hidden></div>
                <div class="feedback-modal__actions">
                    <button class="feedback-modal__history-btn">Мои обращения</button>
                    <button class="feedback-modal__submit-btn">Отправить</button>
                </div>
            </div>`;

        this._element.appendChild(modal);
        this.#attachFormEvents(modal);
    }

    #attachFormEvents(modal) {
        this._addListener(this._element, 'click', (e) => {
            if (e.target === this._element) this.close();
        });

        this._addListener(document, 'keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });

        const closeBtn = modal.querySelector('.feedback-modal__close-btn');
        this._addListener(closeBtn, 'click', () => this.close());

        const categoriesContainer = modal.querySelector('.feedback-modal__categories');
        this._addListener(categoriesContainer, 'click', (e) => {
            const card = e.target.closest('[data-category]');
            if (!card) return;
            categoriesContainer
                .querySelectorAll('.feedback-modal__category-card')
                .forEach((c) => c.classList.remove('feedback-modal__category-card--selected'));
            card.classList.add('feedback-modal__category-card--selected');
            this.#selectedCategory = card.dataset.category;
        });

        const textarea = modal.querySelector('.feedback-modal__textarea');
        const charCount = modal.querySelector('.feedback-modal__char-count');
        this._addListener(textarea, 'input', () => {
            charCount.textContent = `${textarea.value.length} / ${MAX_CONTENT_LENGTH}`;
        });

        const dropzone = modal.querySelector('.feedback-modal__dropzone');
        const fileInput = modal.querySelector('.feedback-modal__file-input');

        this._addListener(dropzone, 'dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('feedback-modal__dropzone--dragover');
        });

        this._addListener(dropzone, 'dragleave', () => {
            dropzone.classList.remove('feedback-modal__dropzone--dragover');
        });

        this._addListener(dropzone, 'drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('feedback-modal__dropzone--dragover');
            this.#addFiles(Array.from(e.dataTransfer.files), modal);
        });

        this._addListener(fileInput, 'change', () => {
            this.#addFiles(Array.from(fileInput.files), modal);
            fileInput.value = '';
        });

        const historyBtn = modal.querySelector('.feedback-modal__history-btn');
        this._addListener(historyBtn, 'click', () => this.#renderList());

        const submitBtn = modal.querySelector('.feedback-modal__submit-btn');
        this._addListener(submitBtn, 'click', () => this.#handleSubmit(modal));
    }

    #addFiles(newFiles, modal) {
        const errorEl = modal.querySelector('.feedback-modal__error');
        errorEl.hidden = true;

        for (const file of newFiles) {
            if (file.size > MAX_FILE_SIZE) {
                errorEl.textContent = `Файл "${file.name}" превышает 10 МБ`;
                errorEl.hidden = false;
                return;
            }
            if (!this.#attachedFiles.some((f) => f.name === file.name && f.size === file.size)) {
                this.#attachedFiles.push(file);
            }
        }
        this.#renderFileList(modal);
    }

    #renderFileList(modal) {
        const list = modal.querySelector('.feedback-modal__file-list');
        list.innerHTML = '';

        this.#attachedFiles.forEach((file, idx) => {
            const item = document.createElement('div');
            item.className = 'feedback-modal__file-item';
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            item.innerHTML = `
                <span class="feedback-modal__file-name">${this.#esc(file.name)}</span>
                <span class="feedback-modal__file-size">${sizeMB} МБ</span>
                <button class="feedback-modal__file-remove" data-idx="${idx}">&times;</button>`;
            list.appendChild(item);
        });

        if (this.#attachedFiles.length > 0) {
            this._addListener(list, 'click', (e) => {
                const removeBtn = e.target.closest('.feedback-modal__file-remove');
                if (!removeBtn) return;
                const idx = parseInt(removeBtn.dataset.idx, 10);
                this.#attachedFiles.splice(idx, 1);
                this.#renderFileList(modal);
            });
        }
    }

    async #handleSubmit(modal) {
        const errorEl = modal.querySelector('.feedback-modal__error');
        const submitBtn = modal.querySelector('.feedback-modal__submit-btn');
        const textarea = modal.querySelector('.feedback-modal__textarea');
        errorEl.hidden = true;

        if (!this.#selectedCategory) {
            errorEl.textContent = 'Выберите тип обращения';
            errorEl.hidden = false;
            return;
        }

        const content = textarea.value.trim();
        if (!content) {
            errorEl.textContent = 'Заполните описание';
            errorEl.hidden = false;
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        try {
            await this.#issueApi.createIssue(this.#selectedCategory, content, this.#attachedFiles);
            this.#renderSuccess();
        } catch (e) {
            errorEl.textContent = e.message || 'Не удалось отправить обращение';
            errorEl.hidden = false;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить';
        }
    }

    #renderSuccess() {
        this._element.innerHTML = '';
        this._clearListeners();

        const modal = document.createElement('div');
        modal.className = 'feedback-modal';

        modal.innerHTML = `
            <div class="feedback-modal__header">
                <div></div>
                <button class="feedback-modal__close-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="feedback-modal__success">
                <div class="feedback-modal__success-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                </div>
                <h3 class="feedback-modal__success-title">Обращение отправлено</h3>
                <p class="feedback-modal__success-text">Мы рассмотрим ваше обращение в ближайшее время</p>
                <button class="feedback-modal__history-btn">Мои обращения</button>
            </div>`;

        this._element.appendChild(modal);

        this._addListener(this._element, 'click', (e) => {
            if (e.target === this._element) this.close();
        });
        this._addListener(document, 'keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });

        const closeBtn = modal.querySelector('.feedback-modal__close-btn');
        this._addListener(closeBtn, 'click', () => this.close());

        const historyBtn = modal.querySelector('.feedback-modal__history-btn');
        this._addListener(historyBtn, 'click', () => this.#renderList());
    }

    async #renderList() {
        this._element.innerHTML = '';
        this._clearListeners();

        const modal = document.createElement('div');
        modal.className = 'feedback-modal';

        modal.innerHTML = `
            <div class="feedback-modal__header">
                <div></div>
                <button class="feedback-modal__close-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="feedback-modal__list-header">
                <h3 class="feedback-modal__list-title">Мои обращения</h3>
                <button class="feedback-modal__new-btn">Новое обращение</button>
            </div>
            <div class="feedback-modal__list-content">
                <div class="feedback-modal__loading">Загрузка...</div>
            </div>`;

        this._element.appendChild(modal);

        this._addListener(this._element, 'click', (e) => {
            if (e.target === this._element) this.close();
        });
        this._addListener(document, 'keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });

        const closeBtn = modal.querySelector('.feedback-modal__close-btn');
        this._addListener(closeBtn, 'click', () => this.close());

        const newBtn = modal.querySelector('.feedback-modal__new-btn');
        this._addListener(newBtn, 'click', () => {
            this.#selectedCategory = null;
            this.#attachedFiles = [];
            this.#renderForm();
        });

        const listContent = modal.querySelector('.feedback-modal__list-content');

        try {
            const data = await this.#issueApi.getIssues();
            const issues = Array.isArray(data) ? data : data?.issues || [];

            if (issues.length === 0) {
                listContent.innerHTML =
                    '<div class="feedback-modal__empty">У вас пока нет обращений</div>';
                return;
            }

            listContent.innerHTML = '';
            issues.forEach((issue) => {
                const card = document.createElement('div');
                card.className = 'feedback-modal__issue-card';
                const cat = CATEGORIES.find((c) => c.value === issue.category);
                const statusLabel = STATUS_LABELS[issue.status] || issue.status;
                const date = new Date(issue.created_at).toLocaleDateString('ru-RU');
                const preview =
                    issue.content.length > 100
                        ? issue.content.substring(0, 100) + '...'
                        : issue.content;

                card.innerHTML = `
                    <div class="feedback-modal__issue-meta">
                        <span class="feedback-modal__badge feedback-modal__badge--${issue.category}">${cat ? cat.sublabel : issue.category}</span>
                        <span class="feedback-modal__badge feedback-modal__badge--${issue.status}">${this.#esc(statusLabel)}</span>
                        <span class="feedback-modal__issue-date">${date}</span>
                    </div>
                    <div class="feedback-modal__issue-preview">${this.#esc(preview)}</div>`;

                card.addEventListener('click', () => this.#renderDetail(issue.id));
                listContent.appendChild(card);
            });
        } catch {
            listContent.innerHTML =
                '<div class="feedback-modal__empty">Не удалось загрузить обращения</div>';
        }
    }

    async #renderDetail(issueId) {
        this._element.innerHTML = '';
        this._clearListeners();

        const modal = document.createElement('div');
        modal.className = 'feedback-modal';

        modal.innerHTML = `
            <div class="feedback-modal__header">
                <div></div>
                <button class="feedback-modal__close-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="feedback-modal__detail-body">
                <div class="feedback-modal__loading">Загрузка...</div>
            </div>`;

        this._element.appendChild(modal);

        this._addListener(this._element, 'click', (e) => {
            if (e.target === this._element) this.close();
        });
        this._addListener(document, 'keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });

        const closeBtn = modal.querySelector('.feedback-modal__close-btn');
        this._addListener(closeBtn, 'click', () => this.close());

        const body = modal.querySelector('.feedback-modal__detail-body');

        try {
            const issue = await this.#issueApi.getIssue(issueId);
            const cat = CATEGORIES.find((c) => c.value === issue.category);
            const statusLabel = STATUS_LABELS[issue.status] || issue.status;
            const date = new Date(issue.created_at).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let attachmentsHtml = '';
            if (issue.attachments && issue.attachments.length > 0) {
                attachmentsHtml = `
                    <div class="feedback-modal__detail-section-title">Вложения</div>
                    <div class="feedback-modal__detail-attachments">
                        ${issue.attachments
                            .map(
                                (att) =>
                                    `<a class="feedback-modal__detail-attachment" href="${this.#issueApi.getAttachmentUrl(issueId, att.id)}" target="_blank">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                                        </svg>
                                        ${this.#esc(att.filename || att.name || 'Файл')}
                                    </a>`
                            )
                            .join('')}
                    </div>`;
            }

            let responseHtml = '';
            if (issue.response) {
                responseHtml = `
                    <div class="feedback-modal__detail-response">
                        <div class="feedback-modal__detail-response-label">Ответ администратора</div>
                        <div class="feedback-modal__detail-response-text">${this.#esc(issue.response)}</div>
                    </div>`;
            }

            body.innerHTML = `
                <button class="feedback-modal__back-btn">&larr; Назад</button>
                <h3 class="feedback-modal__detail-title">Обращение #${issue.id}</h3>
                <div class="feedback-modal__detail-meta">
                    <span class="feedback-modal__badge feedback-modal__badge--${issue.category}">${cat ? cat.sublabel : issue.category}</span>
                    <span class="feedback-modal__badge feedback-modal__badge--${issue.status}">${this.#esc(statusLabel)}</span>
                    <span class="feedback-modal__issue-date">${date}</span>
                </div>
                <div class="feedback-modal__detail-content">${this.#esc(issue.content)}</div>
                ${attachmentsHtml}
                ${responseHtml}`;

            const backBtn = body.querySelector('.feedback-modal__back-btn');
            this._addListener(backBtn, 'click', () => this.#renderList());
        } catch {
            body.innerHTML =
                '<div class="feedback-modal__empty">Не удалось загрузить обращение</div>';
        }
    }

    #esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
