import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { ShareModalTemplate } from './ShareModal.template.js';
import { nn } from '../../shared/utils/notNull.js';
import type { ApiEnvelope, PermissionDTO, PermissionListResponse } from '../../shared/api/types.js';

/**
 * Локальное представление коллаборатора в UI модалки. id — это user_id из
 * PermissionDTO; label — обычно email но fallback'ом "Пользователь #N".
 */
interface Collaborator {
    /** ID пользователя */
    id: number;
    /** Видимая подпись (email или fallback) */
    label: string;
    /** Уровень доступа: 'readonly' / 'editor' */
    permission_level: string;
}

/**
 * Модалка управления доступом к notebook'у. Поддерживает: добавление по email
 * (с валидацией формата и проверкой дублей), смену уровня (readonly/editor)
 * через select, удаление коллаборатора, переключение публичного доступа,
 * копирование ссылки на notebook в буфер.
 *
 * Singleton-подход: один экземпляр маунтится по требованию через open(), при
 * close() размонтируется. Загружает permissions при каждом open() (no-cache
 * чтобы видеть актуальное состояние).
 *
 * Optimistic updates с rollback: смена уровня и публичный тогл сразу обновляют
 * UI; при ошибке API — откатывают значения.
 */
export class ShareModal extends BaseComponent {
    #notebookId: string | number | null = null;
    #notebookTitle = '';
    #http: HttpClient;
    #isPublic = false;
    #collaborators: Collaborator[] = [];

    /**
     * Создаёт модалку с привязкой к body. Element создаётся в open(), не сразу.
     */
    public constructor() {
        super(null, document.body);
        this.#http = HttpClient.getInstance();
    }

    /**
     * Открывает модалку для конкретного notebook'а: загружает текущие permissions,
     * рендерит UI, маунтит, блокирует скролл body, фокусирует email-input.
     * @param notebookId - ID notebook'а
     * @param notebookTitle - текущий title (нужен чтобы не сбросить при PUT для public-toggle)
     * @param isPublic - текущее состояние публичности
     */
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
        this._element.querySelector<HTMLInputElement>('.share-modal__input')?.focus();
    }

    /**
     * Закрывает модалку: размонтирует UI и разблокирует скролл body.
     */
    public close(): void {
        if (!this._isMounted) return;
        super.unmount();
        document.body.style.overflow = '';
    }

    /**
     * Переопределение базового mount: noop. Реальный маунт делается из open()
     * после загрузки данных. Сделано так чтобы родитель не вызывал mount() напрямую.
     */
    public mount(): void {
        /* noop */
    }

    /**
     * Переопределение базового unmount: делегирует в close().
     */
    public unmount(): void {
        this.close();
    }

    /**
     * Загружает текущий список permissions с сервера (no-cache) и преобразует
     * в массив Collaborator. Ошибки молча игнорирует — UI просто будет пустым.
     */
    async #fetchPermissions(): Promise<void> {
        try {
            const res = await this.#http.get(`/notebooks/${String(this.#notebookId)}/permissions`, {
                noCache: true
            });
            if (res.ok) {
                const body = (await res.json()) as Partial<ApiEnvelope<PermissionListResponse>>;
                const perms = body.data?.permissions ?? [];
                this.#collaborators = perms.map((p) => ({
                    id: p.user_id,
                    label: p.email ?? `Пользователь #${String(p.user_id)}`,
                    permission_level: p.permission_level
                }));
            }
        } catch {
            /* empty */
        }
    }

    /**
     * Создаёт DOM-элемент модалки из шаблона с текущими данными и
     * сразу навешивает обработчики.
     */
    #buildElement(): void {
        const tmp = document.createElement('div');
        tmp.innerHTML = ShareModalTemplate({
            isPublic: this.#isPublic,
            collaborators: this.#collaborators
        });
        this._element = tmp.firstElementChild as HTMLElement;
        this.#attachEvents();
    }

    /**
     * Навешивает обработчики: клик по overlay/Escape/close-btn (закрытие),
     * Enter в email-input + click на add-btn (добавление коллаборатора),
     * клик/change по списку коллабораторов (удаление/смена уровня),
     * change на public-toggle, клик на copy-btn (копирование URL).
     */
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

        const input = nn(this._element.querySelector<HTMLInputElement>('.share-modal__input'));
        const addBtn = nn(this._element.querySelector<HTMLButtonElement>('.share-modal__add-btn'));
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async event handler
        this._addListener(addBtn, 'click', () => this.#handleAdd(input));
        this._addListener(input, 'keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Enter') void this.#handleAdd(input);
        });

        const list = this._element.querySelector('.share-modal__collaborators');
        if (list) {
            this._addListener(list, 'click', (e: Event) => {
                const btn = (e.target as HTMLElement).closest<HTMLElement>(
                    '.share-modal__remove-btn'
                );
                if (btn?.dataset.userId !== undefined) void this.#handleRemove(btn.dataset.userId);
            });
            this._addListener(list, 'change', (e: Event) => {
                const sel = (e.target as HTMLElement).closest<HTMLSelectElement>(
                    '.share-modal__collaborator-level'
                );
                if (sel?.dataset.userId !== undefined) {
                    void this.#handleLevelChange(sel.dataset.userId, sel.value);
                }
            });
        }

        const toggle = nn(
            this._element.querySelector<HTMLInputElement>('.share-modal__toggle-input')
        );
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async event handler
        this._addListener(toggle, 'change', () => this.#handlePublicToggle(toggle.checked));

        this._addListener(this._element.querySelector('.share-modal__copy-btn'), 'click', () => {
            void navigator.clipboard.writeText(window.location.href).then(() => {
                this.#showCopyFeedback();
            });
        });
    }

    /**
     * Обрабатывает добавление коллаборатора: валидация email формата + проверка
     * дублей по email, POST /notebooks/:id/permissions/invite. При успехе —
     * добавляет в #collaborators и перерисовывает список; при ошибке — показывает
     * текст ошибки (404 → "не найден", иначе серверная ошибка или fallback).
     * @param input - email-input (используется для чтения и очистки)
     */
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

        const addBtn = nn(this._element.querySelector<HTMLButtonElement>('.share-modal__add-btn'));
        addBtn.disabled = true;
        this.#clearError();

        try {
            const level = 'readonly';

            const res = await this.#http.post(
                `/notebooks/${String(this.#notebookId)}/permissions/invite`,
                {
                    identifier: email,
                    level
                }
            );

            if (res.ok) {
                const body = (await res.json()) as Partial<ApiEnvelope<PermissionDTO>>;
                const created = body.data;
                if (created) {
                    this.#collaborators.push({
                        id: created.user_id,
                        label: email,
                        permission_level: created.permission_level
                    });
                }
                // eslint-disable-next-line require-atomic-updates -- DOM element is captured locally; UI is single-threaded
                input.value = '';
                this.#rerenderList();
            } else if (res.status === 404) {
                this.#showError('Пользователь не найден');
            } else {
                const body = (await res.json().catch(() => ({}))) as { error?: string };
                this.#showError(body.error ?? 'Не удалось добавить пользователя');
            }
        } catch {
            this.#showError('Ошибка соединения');
        } finally {
            addBtn.disabled = false;
        }
    }

    /**
     * Удаляет коллаборатора через DELETE /notebooks/:id/permissions/:user.
     * При успехе — убирает из #collaborators и перерисовывает; ошибки игнорирует.
     * @param userId - ID удаляемого пользователя
     */
    async #handleRemove(userId: string): Promise<void> {
        try {
            const res = await this.#http.delete(
                `/notebooks/${String(this.#notebookId)}/permissions/${userId}`
            );
            if (res.ok || res.status === 204) {
                this.#collaborators = this.#collaborators.filter((c) => String(c.id) !== userId);
                this.#rerenderList();
            }
        } catch {
            /* ignore */
        }
    }

    /**
     * Меняет уровень доступа коллаборатора (optimistic update: сразу обновляет
     * локально, при ошибке API — откатывает и перерисовывает).
     * @param userId - ID пользователя
     * @param level - новый уровень ('readonly' / 'editor')
     */
    async #handleLevelChange(userId: string, level: string): Promise<void> {
        const collaborator = this.#collaborators.find((c) => String(c.id) === userId);
        if (!collaborator) return;

        const prev = collaborator.permission_level;
        collaborator.permission_level = level;

        try {
            const res = await this.#http.put(
                `/notebooks/${String(this.#notebookId)}/permissions/${userId}`,
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

    /**
     * Переключает публичный доступ к notebook'у через PUT /notebooks/:id
     * (с сохранением title чтобы не сбросить). Optimistic update — при ошибке
     * откатывает чекбокс. title обязательно посылается потому что endpoint
     * принимает полный объект, не PATCH.
     * @param checked - новое состояние тогла
     */
    async #handlePublicToggle(checked: boolean): Promise<void> {
        const prev = this.#isPublic;
        this.#isPublic = checked;

        try {
            const res = await this.#http.put(`/notebooks/${String(this.#notebookId)}`, {
                title: this.#notebookTitle,
                is_public: checked
            });
            if (!res.ok) {
                this.#isPublic = prev;
                const toggle = this._element.querySelector<HTMLInputElement>(
                    '.share-modal__toggle-input'
                );
                if (toggle) toggle.checked = prev;
            }
        } catch {
            this.#isPublic = prev;
            const toggle = this._element.querySelector<HTMLInputElement>(
                '.share-modal__toggle-input'
            );
            if (toggle) toggle.checked = prev;
        }
    }

    /**
     * Перерисовывает только секцию списка коллабораторов и навешивает
     * обработчики на новые элементы (старые слушатели останутся в реестре, но
     * на удалённых элементах будут no-op'ами — это допустимая утечка для
     * редко открываемой модалки). Если список пуст — показывает empty-state.
     */
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
            <div class="share-modal__collaborator" data-user-id="${String(c.id)}">
                <span class="share-modal__collaborator-email">${this.#escape(c.label)}</span>
                <select class="share-modal__collaborator-level" data-user-id="${String(c.id)}" title="Уровень доступа">
                    <option value="readonly" ${c.permission_level === 'readonly' ? 'selected' : ''}>Просмотр</option>
                    <option value="editor" ${c.permission_level === 'editor' ? 'selected' : ''}>Редактор</option>
                </select>
                <button class="share-modal__remove-btn" title="Убрать доступ" data-user-id="${String(c.id)}">
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
                const btn = (e.target as HTMLElement).closest<HTMLElement>(
                    '.share-modal__remove-btn'
                );
                if (btn?.dataset.userId !== undefined) void this.#handleRemove(btn.dataset.userId);
            });
            this._addListener(list, 'change', (e: Event) => {
                const sel = (e.target as HTMLElement).closest<HTMLSelectElement>(
                    '.share-modal__collaborator-level'
                );
                if (sel?.dataset.userId !== undefined) {
                    void this.#handleLevelChange(sel.dataset.userId, sel.value);
                }
            });
        }
    }

    /**
     * Показывает текст ошибки в .share-modal__error.
     * @param msg - текст для отображения
     */
    #showError(msg: string): void {
        const el = this._element.querySelector<HTMLElement>('.share-modal__error');
        if (!el) return;
        el.textContent = msg;
        el.hidden = false;
    }

    /**
     * Скрывает блок ошибки.
     */
    #clearError(): void {
        const el = this._element.querySelector<HTMLElement>('.share-modal__error');
        if (el) el.hidden = true;
    }

    /**
     * Показывает кратковременное подтверждение копирования ("Скопировано!" +
     * success-класс) на 2 секунды, потом восстанавливает оригинальное содержимое.
     */
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

    /**
     * Проверяет email на минимальный формат через простую регулярку.
     * @param email - проверяемая строка
     * @returns true если похоже на email
     */
    #isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Экранирует HTML-спецсимволы для безопасной вставки в innerHTML
     * (используется для label'ов коллабораторов в #rerenderList).
     * Локальная копия escapeHtml без зависимости.
     * @param str - строка для эскейпа
     * @returns HTML-безопасная строка
     */
    #escape(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
