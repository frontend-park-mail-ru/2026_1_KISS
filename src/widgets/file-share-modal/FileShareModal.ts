import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { StorageApi } from '../../shared/api/StorageApi.js';
import { logError } from '../../shared/utils/logger.js';
import { nn } from '../../shared/utils/notNull.js';
import { FileShareModalTemplate } from './FileShareModal.template.js';
import type { FileItemDTO, FileShareDTO } from '../../shared/api/types.js';

/**
 * Локальное представление одного приглашённого пользователя в UI модалки.
 */
interface FileCollaborator {
    /** ID пользователя */
    id: number;
    /** Видимая подпись (email или fallback) */
    label: string;
    /** Уровень доступа: 'view' / 'download' */
    permission_level: string;
}

/**
 * Модалка управления доступом к файлу. По образцу ShareModal для notebook'ов,
 * но с учётом особенностей файлов: уровни view/download (вместо readonly/editor),
 * отдельный тоггл публичной ссылки с выбором срока жизни (24ч/7д/30д/без),
 * копирование сгенерированного публичного URL.
 *
 * Singleton-подход: один экземпляр для всего приложения, маунтится по требованию
 * через open(file). По close() — размонтируется и разблокирует scroll.
 */
export class FileShareModal extends BaseComponent {
    static #instance: FileShareModal | null = null;
    #file: FileItemDTO | null = null;
    #storage: StorageApi;
    #collaborators: FileCollaborator[] = [];
    #lifetime = '7d';

    /**
     * Создаёт singleton (через getInstance). Element создаётся только при open.
     */
    public constructor() {
        super(null, document.body);
        this.#storage = StorageApi.getInstance();
    }

    /**
     * Возвращает singleton-экземпляр.
     * @returns единственный экземпляр FileShareModal
     */
    public static getInstance(): FileShareModal {
        FileShareModal.#instance ??= new FileShareModal();
        return FileShareModal.#instance;
    }

    /**
     * Открывает модалку для конкретного файла: подтягивает список приглашённых,
     * собирает DOM из шаблона, навешивает обработчики, блокирует scroll body.
     * @param file - DTO файла, для которого настраиваем доступ
     */
    public async open(file: FileItemDTO): Promise<void> {
        this.#file = file;
        this.#collaborators = [];
        this.#lifetime =
            file.share_expires_at !== null &&
            file.share_expires_at !== undefined &&
            file.share_expires_at !== ''
                ? this.#guessLifetime(file.share_expires_at)
                : '7d';

        await this.#fetchShares();
        this.#buildElement();
        super.mount();
        document.body.style.overflow = 'hidden';
        this._element.querySelector<HTMLInputElement>('.file-share-modal__input')?.focus();
    }

    /**
     * Закрывает модалку и разблокирует scroll.
     */
    public close(): void {
        if (!this._isMounted) return;
        super.unmount();
        document.body.style.overflow = '';
    }

    /**
     * Переопределение базового mount: noop. Реальный монтаж делает open().
     */
    public override mount(): void {
        /* noop */
    }

    /**
     * Переопределение базового unmount: делегирует в close().
     */
    public override unmount(): void {
        this.close();
    }

    /**
     * Подтягивает текущий список приглашённых с бэка.
     */
    async #fetchShares(): Promise<void> {
        if (!this.#file) return;
        try {
            const resp = await this.#storage.listShares(this.#file.id);
            this.#collaborators = resp.shares.map((s) => ({
                id: s.user_id,
                label: s.email ?? `Пользователь #${String(s.user_id)}`,
                permission_level: s.permission_level
            }));
        } catch (error) {
            logError('FileShareModal.fetchShares failed', error);
        }
    }

    /**
     * Создаёт DOM-элемент из шаблона и навешивает обработчики.
     */
    #buildElement(): void {
        const file = nn(this.#file);
        const tmp = document.createElement('div');
        tmp.innerHTML = FileShareModalTemplate({
            filename: file.filename,
            isPublic: file.is_public,
            publicUrl: this.#buildPublicUrl(file.public_url ?? null),
            selectedLifetime: this.#lifetime,
            collaborators: this.#collaborators
        });
        this._element = tmp.firstElementChild as HTMLElement;
        this.#attachEvents();
    }

    /**
     * Собирает абсолютный URL публичной ссылки на основе относительного, который
     * возвращает бэк. Если относительный путь пуст — null.
     * @param relative - относительный URL вида /api/v1/shared/files/<token>
     * @returns абсолютный URL или null
     */
    #buildPublicUrl(relative: string | null): string | null {
        if (relative === null || relative === '') return null;
        return `${window.location.origin}${relative}`;
    }

    /**
     * Угадывает выбранный пользователем срок жизни ссылки по сохранённому
     * share_expires_at. Если до истечения больше 28 дней — 30d, больше 5 — 7d,
     * больше нескольких часов — 24h. Используется только при первичном
     * открытии для предзаполнения radio'ов.
     * @param expiresAt - ISO-строка срока истечения
     * @returns ключ срока: '24h' / '7d' / '30d' / 'forever'
     */
    #guessLifetime(expiresAt: string): string {
        const ms = new Date(expiresAt).getTime() - Date.now();
        if (Number.isNaN(ms) || ms <= 0) return '7d';
        const hours = ms / 3_600_000;
        if (hours > 28 * 24) return '30d';
        if (hours > 5 * 24) return '7d';
        return '24h';
    }

    /**
     * Конвертирует ключ срока в ISO-дату от текущего момента; 'forever' → null.
     * @param key - выбранный ключ срока
     * @returns ISO-строка или null
     */
    #lifetimeToISO(key: string): string | null {
        const now = Date.now();
        switch (key) {
            case '24h':
                return new Date(now + 24 * 3_600_000).toISOString();
            case '7d':
                return new Date(now + 7 * 24 * 3_600_000).toISOString();
            case '30d':
                return new Date(now + 30 * 24 * 3_600_000).toISOString();
            default:
                return null;
        }
    }

    /**
     * Навешивает обработчики событий на все интерактивные элементы.
     */
    #attachEvents(): void {
        this._addListener(
            this._element.querySelector('.file-share-modal__overlay'),
            'click',
            (e: Event) => {
                if (e.target === e.currentTarget) this.close();
            }
        );
        this._addListener(
            this._element.querySelector('.file-share-modal__close-btn'),
            'click',
            () => {
                this.close();
            }
        );
        this._addListener(document, 'keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Escape') this.close();
        });

        const toggle = nn(
            this._element.querySelector<HTMLInputElement>('.file-share-modal__toggle-input')
        );
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async event handler
        this._addListener(toggle, 'change', () => this.#handlePublicToggle(toggle.checked));

        const lifetimeRadios = this._element.querySelectorAll<HTMLInputElement>(
            'input[name="file-share-lifetime"]'
        );
        lifetimeRadios.forEach((radio) => {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async event handler
            this._addListener(radio, 'change', () => this.#handleLifetimeChange(radio.value));
        });

        this._addListener(
            this._element.querySelector('.file-share-modal__copy-btn'),
            'click',
            () => {
                this.#handleCopy();
            }
        );

        const input = nn(this._element.querySelector<HTMLInputElement>('.file-share-modal__input'));
        const levelSel = nn(
            this._element.querySelector<HTMLSelectElement>('.file-share-modal__level-select')
        );
        const addBtn = nn(
            this._element.querySelector<HTMLButtonElement>('.file-share-modal__add-btn')
        );
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async event handler
        this._addListener(addBtn, 'click', () => this.#handleAdd(input, levelSel));
        this._addListener(input, 'keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Enter') void this.#handleAdd(input, levelSel);
        });

        this.#attachListListeners();
    }

    /**
     * Навешивает делегирование обработчиков на корневой контейнер списка
     * приглашённых: клики (удаление) и change (смена уровня).
     */
    #attachListListeners(): void {
        const list = this._element.querySelector('.file-share-modal__collaborators');
        if (!list) return;
        this._addListener(list, 'click', (e: Event) => {
            const btn = (e.target as HTMLElement).closest<HTMLElement>(
                '.file-share-modal__remove-btn'
            );
            if (btn?.dataset.userId !== undefined) {
                void this.#handleRemove(btn.dataset.userId);
            }
        });
        this._addListener(list, 'change', (e: Event) => {
            const sel = (e.target as HTMLElement).closest<HTMLSelectElement>(
                '.file-share-modal__collaborator-level'
            );
            if (sel?.dataset.userId !== undefined) {
                void this.#handleLevelChange(sel.dataset.userId, sel.value);
            }
        });
    }

    /**
     * Переключает публичный доступ. При включении использует выбранный срок
     * через #lifetimeToISO; при выключении показывает confirm и обнуляет токен.
     * При ошибке откатывает чекбокс.
     * @param checked - новое состояние тогла
     */
    async #handlePublicToggle(checked: boolean): Promise<void> {
        const file = nn(this.#file);
        if (!checked) {
            // eslint-disable-next-line no-alert -- TODO(ui): replace with confirmation modal
            const ok = window.confirm(
                'Отключить публичную ссылку? Текущая ссылка перестанет работать.'
            );
            if (!ok) {
                const toggle = nn(
                    this._element.querySelector<HTMLInputElement>('.file-share-modal__toggle-input')
                );
                toggle.checked = true;
                return;
            }
        }
        try {
            const updated = await this.#storage.setPublic(
                file.id,
                checked,
                checked ? this.#lifetimeToISO(this.#lifetime) : null
            );
            this.#file = updated;
            this.#rerender();
        } catch (error) {
            logError('FileShareModal.setPublic failed', error);
            const toggle = nn(
                this._element.querySelector<HTMLInputElement>('.file-share-modal__toggle-input')
            );
            toggle.checked = !checked;
        }
    }

    /**
     * Меняет срок жизни уже выпущенной публичной ссылки. Тихо игнорирует
     * ошибки сети, но в UI оставляет ранее выбранный radio (без отката, чтобы
     * не мешать пользователю).
     * @param key - новый ключ срока ('24h' / '7d' / '30d' / 'forever')
     */
    async #handleLifetimeChange(key: string): Promise<void> {
        const file = nn(this.#file);
        this.#lifetime = key;
        if (!file.is_public) return;
        try {
            const updated = await this.#storage.setPublic(file.id, true, this.#lifetimeToISO(key));
            this.#file = updated;
        } catch (error) {
            logError('FileShareModal.lifetimeChange failed', error);
        }
    }

    /**
     * Копирует публичный URL в буфер обмена и показывает кратковременный
     * фидбек на кнопке.
     */
    #handleCopy(): void {
        const input = this._element.querySelector<HTMLInputElement>(
            '.file-share-modal__link-input'
        );
        if (input === null || input.value === '') return;
        void navigator.clipboard.writeText(input.value).then(() => {
            this.#showCopyFeedback();
        });
    }

    /**
     * Показывает «Скопировано!» на 2 секунды на кнопке копирования.
     */
    #showCopyFeedback(): void {
        const btn = this._element.querySelector('.file-share-modal__copy-btn');
        if (!btn) return;
        const original = btn.innerHTML;
        btn.textContent = 'Скопировано!';
        btn.classList.add('file-share-modal__copy-btn--success');
        setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('file-share-modal__copy-btn--success');
        }, 2000);
    }

    /**
     * Добавляет нового приглашённого. Валидирует email и не позволяет
     * пригласить уже добавленного.
     * @param input - input с email
     * @param levelSel - select уровня
     */
    async #handleAdd(input: HTMLInputElement, levelSel: HTMLSelectElement): Promise<void> {
        const file = nn(this.#file);
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
        const level: 'view' | 'download' = levelSel.value === 'view' ? 'view' : 'download';
        const addBtn = nn(
            this._element.querySelector<HTMLButtonElement>('.file-share-modal__add-btn')
        );
        addBtn.disabled = true;
        this.#clearError();
        try {
            const share: FileShareDTO = await this.#storage.shareFile(file.id, email, level);
            this.#collaborators.push({
                id: share.user_id,
                label: share.email ?? email,
                permission_level: share.permission_level
            });
            // eslint-disable-next-line require-atomic-updates -- DOM single-threaded; input captured locally
            input.value = '';
            this.#rerenderList();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Не удалось добавить пользователя';
            this.#showError(msg);
        } finally {
            addBtn.disabled = false;
        }
    }

    /**
     * Удаляет приглашение конкретного пользователя.
     * @param userId - ID удаляемого пользователя (строкой из data-attribute)
     */
    async #handleRemove(userId: string): Promise<void> {
        const file = nn(this.#file);
        const id = Number(userId);
        try {
            await this.#storage.revokeShare(file.id, id);
            this.#collaborators = this.#collaborators.filter((c) => c.id !== id);
            this.#rerenderList();
        } catch (error) {
            logError('FileShareModal.remove failed', error);
        }
    }

    /**
     * Меняет уровень доступа существующего приглашённого. Optimistic:
     * сразу обновляем локально, при ошибке откатываем select.
     * @param userId - ID пользователя
     * @param level - новый уровень ('view' / 'download')
     */
    async #handleLevelChange(userId: string, level: string): Promise<void> {
        const file = nn(this.#file);
        const collab = this.#collaborators.find((c) => String(c.id) === userId);
        if (!collab) return;
        const prev = collab.permission_level;
        collab.permission_level = level;
        const lvl: 'view' | 'download' = level === 'view' ? 'view' : 'download';
        try {
            await this.#storage.updateShare(file.id, collab.id, lvl);
        } catch (error) {
            logError('FileShareModal.levelChange failed', error);
            collab.permission_level = prev;
            this.#rerenderList();
        }
    }

    /**
     * Перерисовывает весь body модалки на основе текущего #file. Используется
     * после смены public-state — там меняется и видимость секций.
     */
    #rerender(): void {
        if (!this._element.parentNode) return;
        const parent = this._element.parentNode;
        const old = this._element;
        this.#buildElement();
        parent.replaceChild(this._element, old);
    }

    /**
     * Перерисовывает только секцию списка приглашённых и заново навешивает
     * слушатели на список.
     */
    #rerenderList(): void {
        const section = this._element.querySelector('.file-share-modal__section--list');
        if (!section) return;
        if (this.#collaborators.length === 0) {
            section.innerHTML =
                '<p class="file-share-modal__empty">Нет пользователей с доступом</p>';
            return;
        }
        const items = this.#collaborators
            .map(
                (c) => `
            <div class="file-share-modal__collaborator" data-user-id="${String(c.id)}">
                <span class="file-share-modal__collaborator-email">${this.#escape(c.label)}</span>
                <select class="file-share-modal__collaborator-level" data-user-id="${String(c.id)}" title="Уровень доступа">
                    <option value="view" ${c.permission_level === 'view' ? 'selected' : ''}>Просмотр</option>
                    <option value="download" ${c.permission_level === 'download' ? 'selected' : ''}>Скачивание</option>
                </select>
                <button class="file-share-modal__remove-btn" title="Убрать доступ" data-user-id="${String(c.id)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>`
            )
            .join('');
        section.innerHTML = `<div class="file-share-modal__collaborators">${items}</div>`;
        this.#attachListListeners();
    }

    /**
     * Показывает сообщение об ошибке в блоке .file-share-modal__error.
     * @param msg - текст ошибки
     */
    #showError(msg: string): void {
        const el = this._element.querySelector<HTMLElement>('.file-share-modal__error');
        if (!el) return;
        el.textContent = msg;
        el.hidden = false;
    }

    /**
     * Скрывает блок ошибки.
     */
    #clearError(): void {
        const el = this._element.querySelector<HTMLElement>('.file-share-modal__error');
        if (el) el.hidden = true;
    }

    /**
     * Проверяет email на минимальный формат.
     * @param email - проверяемая строка
     * @returns true если похоже на email
     */
    #isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Экранирует HTML-спецсимволы для безопасной вставки в innerHTML.
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
