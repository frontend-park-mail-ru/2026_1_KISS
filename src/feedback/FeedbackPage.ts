/* eslint-disable max-lines, max-lines-per-function -- TODO(refactor): split #renderDetail into header/messages/attachments helpers; pre-existing tech debt */
import { IssueApi } from '../shared/api/IssueApi.js';
import { nn } from '../shared/utils/notNull.js';

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
] as const;

const STATUS_LABELS: Record<string, string> = {
    open: 'Новое',
    in_progress: 'В работе',
    closed: 'Закрыто'
};

const MAX_CONTENT_LENGTH = 2000;

/**
 * Страница обратной связи (открывается в iframe из FeedbackModal). Имеет три
 * основных view: форма создания обращения (с выбором категории и текстом),
 * список своих обращений (history), детальный просмотр одного с тредом сообщений
 * и формой ответа.
 *
 * Связь с родительским окном — через postMessage:
 * - При готовности шлёт `feedback:ready` родителю.
 * - Слушает `feedback:open` чтобы показать форму при повторном открытии.
 * - Шлёт `feedback:close` при пользовательском закрытии (X или клик вне модалки).
 *
 * Изолирована от основного SPA — собственный bootstrap из feedback/index.ts.
 */
export class FeedbackPage {
    #root: HTMLElement;
    #issueApi: IssueApi;
    #selectedCategory: string | null = null;
    #escHandler: ((e: KeyboardEvent) => void) | null = null;

    /**
     * Сохраняет root и инстанцирует IssueApi.
     * @param root - корневой элемент iframe'а (#feedback-root)
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#issueApi = new IssueApi();
    }

    /**
     * Регистрирует postMessage-обработчик для команд от родителя (open),
     * клик на overlay (close), сразу рендерит форму и шлёт `feedback:ready` родителю.
     */
    public init(): void {
        window.addEventListener('message', (e: MessageEvent<{ type?: string } | undefined>) => {
            if (e.data?.type === 'feedback:open') {
                this.#selectedCategory = null;
                this.#renderForm();
            }
        });

        this.#root.addEventListener('click', (e: Event) => {
            if (e.target === this.#root) this.#close();
        });

        this.#renderForm();
        window.parent.postMessage({ type: 'feedback:ready' }, '*');
    }

    /**
     * Шлёт родителю `feedback:close` — родитель сам скрывает iframe.
     */
    #close(): void {
        window.parent.postMessage({ type: 'feedback:close' }, '*');
    }

    /**
     * Перерегистрирует обработчик Escape с новой функцией. Старый снимается.
     * Используется при смене view (form/list/detail) чтобы Escape всегда
     * вызывал актуальное действие (обычно close, но в detail можно было бы
     * вернуть на список).
     * @param fn - функция вызываемая при Escape
     */
    #setEsc(fn: () => void): void {
        if (this.#escHandler)
            document.removeEventListener('keydown', this.#escHandler as EventListener);
        this.#escHandler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') fn();
        };
        document.addEventListener('keydown', this.#escHandler as EventListener);
    }

    /**
     * Рендерит главный view: форма с категориями (4 карточки), textarea для
     * описания (max 2000 символов), кнопки "Мои обращения" и "Отправить".
     */
    #renderForm(): void {
        this.#root.innerHTML = '';
        this.#setEsc(() => {
            this.#close();
        });

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
                    <textarea class="feedback-modal__textarea" maxlength="${String(MAX_CONTENT_LENGTH)}" placeholder="Расскажите подробнее, что произошло / что можно улучшить...\nЧто вы делали? Что ожидали? Что пошло не так?"></textarea>
                    <span class="feedback-modal__char-count">0 / ${String(MAX_CONTENT_LENGTH)}</span>
                </div>
                <div class="feedback-modal__error" hidden></div>
                <div class="feedback-modal__actions">
                    <button class="feedback-modal__history-btn">Мои обращения</button>
                    <button class="feedback-modal__submit-btn">Отправить</button>
                </div>
            </div>`;

        this.#root.appendChild(modal);
        this.#attachFormEvents(modal);
    }

    /**
     * Навешивает обработчики формы: close, выбор категории (single-select с
     * подсветкой), счётчик символов в textarea, переход на список и submit.
     * @param modal - корневой элемент модалки формы
     */
    #attachFormEvents(modal: HTMLElement): void {
        nn(modal.querySelector('.feedback-modal__close-btn')).addEventListener('click', () => {
            this.#close();
        });

        const categoriesContainer = nn(modal.querySelector('.feedback-modal__categories'));
        categoriesContainer.addEventListener('click', (e: Event) => {
            const card = (e.target as HTMLElement).closest<HTMLElement>('[data-category]');
            if (!card) return;
            categoriesContainer.querySelectorAll('.feedback-modal__category-card').forEach((c) => {
                c.classList.remove('feedback-modal__category-card--selected');
            });
            card.classList.add('feedback-modal__category-card--selected');
            this.#selectedCategory = nn(card.dataset.category);
        });

        const textarea = nn(modal.querySelector<HTMLTextAreaElement>('.feedback-modal__textarea'));
        const charCount = nn(modal.querySelector('.feedback-modal__char-count'));
        textarea.addEventListener('input', () => {
            charCount.textContent = `${String(textarea.value.length)} / ${String(MAX_CONTENT_LENGTH)}`;
        });

        nn(modal.querySelector('.feedback-modal__history-btn'))
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            .addEventListener('click', () => this.#renderList());
        nn(modal.querySelector('.feedback-modal__submit-btn'))
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            .addEventListener('click', () => this.#handleSubmit(modal));
    }

    /**
     * Валидирует категорию и текст, отправляет POST /issues, при успехе
     * показывает success-view; при ошибке — текст в error-блоке и разблокирует кнопку.
     * @param modal - корневой элемент модалки для доступа к её полям
     */
    async #handleSubmit(modal: HTMLElement): Promise<void> {
        const errorEl = nn(modal.querySelector<HTMLElement>('.feedback-modal__error'));
        const submitBtn = nn(modal.querySelector<HTMLButtonElement>('.feedback-modal__submit-btn'));
        const textarea = nn(modal.querySelector<HTMLTextAreaElement>('.feedback-modal__textarea'));
        errorEl.hidden = true;

        if ((this.#selectedCategory ?? '') === '') {
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
            await this.#issueApi.createIssue(nn(this.#selectedCategory), content);
            this.#renderSuccess();
        } catch (e: unknown) {
            errorEl.textContent = (e as Error).message || 'Не удалось отправить обращение';
            errorEl.hidden = false;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить';
        }
    }

    /**
     * Рендерит success-view после успешной отправки: галочка + сообщение +
     * кнопка перехода на список своих обращений.
     */
    #renderSuccess(): void {
        this.#root.innerHTML = '';
        this.#setEsc(() => {
            this.#close();
        });

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

        this.#root.appendChild(modal);
        nn(modal.querySelector('.feedback-modal__close-btn')).addEventListener('click', () => {
            this.#close();
        });
        nn(modal.querySelector('.feedback-modal__history-btn'))
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            .addEventListener('click', () => this.#renderList());
    }

    /**
     * Рендерит список своих обращений (history): подгружает через IssueApi,
     * для каждого создаёт карточку с категорией/статусом/датой и кнопкой удаления.
     * Клик по карточке — переход к детальному просмотру.
     */
    async #renderList(): Promise<void> {
        this.#root.innerHTML = '';
        this.#setEsc(() => {
            this.#close();
        });

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

        this.#root.appendChild(modal);
        nn(modal.querySelector('.feedback-modal__close-btn')).addEventListener('click', () => {
            this.#close();
        });
        nn(modal.querySelector('.feedback-modal__new-btn')).addEventListener('click', () => {
            this.#selectedCategory = null;
            this.#renderForm();
        });

        const listContent = nn(modal.querySelector('.feedback-modal__list-content'));

        try {
            const data = await this.#issueApi.getIssues();
            const issues = data.issues as unknown as Record<string, unknown>[];

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
                const statusLabel =
                    STATUS_LABELS[issue.status as string] || (issue.status as string);
                const date = new Date(issue.created_at as string).toLocaleDateString('ru-RU');
                const content = issue.content as string;
                const preview = content.length > 100 ? `${content.substring(0, 100)}...` : content;

                card.innerHTML = `
                    <div class="feedback-modal__issue-meta">
                        <span class="feedback-modal__badge feedback-modal__badge--${String(issue.category)}">${String(cat ? cat.sublabel : issue.category)}</span>
                        <span class="feedback-modal__badge feedback-modal__badge--${String(issue.status)}">${this.#esc(statusLabel)}</span>
                        <span class="feedback-modal__issue-date">${date}</span>
                        <button class="feedback-modal__issue-delete-btn" type="button">Удалить</button>
                    </div>
                    <div class="feedback-modal__issue-preview">${this.#esc(preview)}</div>`;

                const deleteBtn = nn(
                    card.querySelector<HTMLButtonElement>('.feedback-modal__issue-delete-btn')
                );
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                deleteBtn.addEventListener('click', async (e: Event) => {
                    e.stopPropagation();
                    await this.#handleIssueDelete(
                        issue.id as number,
                        card,
                        listContent as HTMLElement,
                        deleteBtn
                    );
                });

                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                card.addEventListener('click', () => this.#renderDetail(issue.id as number));
                listContent.appendChild(card);
            });
        } catch {
            listContent.innerHTML =
                '<div class="feedback-modal__empty">Не удалось загрузить обращения</div>';
        }
    }

    /**
     * Удаляет issue после подтверждения через confirm(). При успехе убирает
     * карточку из DOM (и показывает empty-state если ничего не осталось);
     * при ошибке — alert с текстом и разблокирует кнопку.
     * @param issueId - ID удаляемого issue
     * @param card - DOM-карточка для удаления при успехе
     * @param listContent - контейнер всех карточек (для empty-state)
     * @param btn - кнопка удаления для блокировки/разблокировки
     */
    async #handleIssueDelete(
        issueId: number,
        card: HTMLElement,
        listContent: HTMLElement,
        btn: HTMLButtonElement
    ): Promise<void> {
        // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
        if (!window.confirm('Удалить это обращение?')) {
            return;
        }

        const initialText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Удаление...';

        try {
            await this.#issueApi.deleteIssue(issueId);
            card.remove();

            if (!listContent.querySelector('.feedback-modal__issue-card')) {
                listContent.innerHTML =
                    '<div class="feedback-modal__empty">У вас пока нет обращений</div>';
            }
        } catch (e: unknown) {
            // eslint-disable-next-line require-atomic-updates -- DOM element is captured locally; UI is single-threaded
            btn.disabled = false;
            // eslint-disable-next-line require-atomic-updates -- DOM element is captured locally; UI is single-threaded
            btn.textContent = initialText;
            // eslint-disable-next-line no-alert -- admin-only confirmation/notification dialog
            window.alert((e as Error).message || 'Не удалось удалить обращение');
        }
    }

    /**
     * Рендерит детальный view одного issue: метаданные, исходный текст,
     * тред сообщений с пометкой admin/user, форма ответа с textarea (max 2000).
     * При отправке ответа — refresh всего детального view (для показа нового сообщения).
     * @param issueId - ID issue для просмотра
     */
    async #renderDetail(issueId: number): Promise<void> {
        this.#root.innerHTML = '';
        this.#setEsc(() => {
            this.#close();
        });

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

        this.#root.appendChild(modal);
        nn(modal.querySelector('.feedback-modal__close-btn')).addEventListener('click', () => {
            this.#close();
        });

        const body = nn(modal.querySelector('.feedback-modal__detail-body'));

        try {
            const issue = (await this.#issueApi.getIssue(issueId)) as unknown as Record<
                string,
                unknown
            >;
            const cat = CATEGORIES.find((c) => c.value === issue.category);
            const statusLabel = STATUS_LABELS[issue.status as string] || (issue.status as string);
            const date = new Date(issue.created_at as string).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const messages = issue.messages as Record<string, unknown>[] | undefined;
            const messagesHtml =
                messages && messages.length > 0
                    ? `<div class="feedback-modal__detail-section-title">Переписка</div>
                       <div class="feedback-modal__messages">
                           ${messages
                               .map(
                                   (msg) => `
                               <div class="feedback-modal__message feedback-modal__message--${msg.is_admin !== undefined && msg.is_admin !== null ? 'admin' : 'user'}">
                                   <div class="feedback-modal__message-meta">
                                       <span class="feedback-modal__message-author">${this.#esc(msg.username as string)}${msg.is_admin !== undefined && msg.is_admin !== null ? ' (поддержка)' : ''}</span>
                                       <span class="feedback-modal__message-date">${new Date(msg.created_at as string).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                   </div>
                                   <div class="feedback-modal__message-text">${this.#esc(msg.content as string)}</div>
                               </div>`
                               )
                               .join('')}
                       </div>`
                    : '';

            body.innerHTML = `
                <button class="feedback-modal__back-btn">&larr; Назад</button>
                <h3 class="feedback-modal__detail-title">Обращение #${String(issue.id)}</h3>
                <div class="feedback-modal__detail-meta">
                    <span class="feedback-modal__badge feedback-modal__badge--${String(issue.category)}">${String(cat ? cat.sublabel : issue.category)}</span>
                    <span class="feedback-modal__badge feedback-modal__badge--${String(issue.status)}">${this.#esc(statusLabel)}</span>
                    <span class="feedback-modal__issue-date">${date}</span>
                </div>
                <div class="feedback-modal__detail-content">${this.#esc(issue.content as string)}</div>
                ${messagesHtml}
                <div class="feedback-modal__reply-section">
                    <textarea class="feedback-modal__reply-textarea" placeholder="Написать ответ..." maxlength="2000"></textarea>
                    <div class="feedback-modal__reply-actions">
                        <span class="feedback-modal__reply-count">0 / 2000</span>
                        <button class="feedback-modal__reply-btn">Отправить</button>
                    </div>
                    <div class="feedback-modal__reply-error" hidden></div>
                </div>`;

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            nn(body.querySelector('.feedback-modal__back-btn')).addEventListener('click', () =>
                this.#renderList()
            );

            const replyTextarea = nn(
                body.querySelector<HTMLTextAreaElement>('.feedback-modal__reply-textarea')
            );
            const replyCount = nn(body.querySelector('.feedback-modal__reply-count'));
            const replyBtn = nn(
                body.querySelector<HTMLButtonElement>('.feedback-modal__reply-btn')
            );
            const replyError = nn(body.querySelector<HTMLElement>('.feedback-modal__reply-error'));

            replyTextarea.addEventListener('input', () => {
                replyCount.textContent = `${String(replyTextarea.value.length)} / 2000`;
            });

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            replyBtn.addEventListener('click', async () => {
                const text = replyTextarea.value.trim();
                if (!text) return;
                replyBtn.disabled = true;
                replyBtn.textContent = 'Отправка...';
                replyError.hidden = true;
                try {
                    await this.#issueApi.addMessage(issueId, text);
                    void this.#renderDetail(issueId);
                } catch (e: unknown) {
                    replyError.textContent = (e as Error).message || 'Не удалось отправить';
                    replyError.hidden = false;
                    replyBtn.disabled = false;
                    replyBtn.textContent = 'Отправить';
                }
            });
        } catch {
            body.innerHTML =
                '<div class="feedback-modal__empty">Не удалось загрузить обращение</div>';
        }
    }

    /**
     * Локальный HTML-эскейп через DOM API (textContent → innerHTML). Локальная
     * копия escapeHtml без зависимости от utils.
     * @param str - строка для эскейпа
     * @returns HTML-безопасная строка (или пустая для falsy входа)
     */
    #esc(str: string): string {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
