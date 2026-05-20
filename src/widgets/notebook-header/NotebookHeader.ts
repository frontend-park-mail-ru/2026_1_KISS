import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { Router } from '../../shared/router/Router.js';
import { NotebookHeaderTemplate } from './NotebookHeader.template.js';
import { nn } from '../../shared/utils/notNull.js';

/**
 * Конфиг шапки notebook'а. Все callback'и опциональны — кнопки/пункты меню
 * без обработчиков просто не реагируют. isOwner=true разрешает rename/share.
 */
interface NotebookHeaderConfig {
    /** Имя файла notebook'а */
    filename?: string;
    /** Данные пользователя для user-pill */
    user?: {
        /** URL аватара */
        avatarUrl?: string;
        /** Инициалы для default-аватара */
        initials: string;
        /** Логин */
        username: string;
    } | null;
    /** true если владелец — показывает edit/share кнопки (default true) */
    isOwner?: boolean;
    /** Callback переименования; возвращает Promise — UI ждёт перед resolve */
    onRename?: ((newTitle: string) => Promise<void>) | null;
    /** Callback клика по кнопке share */
    onShare?: (() => void) | null;
    /** Callback "Профиль" в user-dropdown */
    onProfile?: (() => void) | null;
    /** Callback "Выйти" в user-dropdown */
    onLogout?: (() => void) | null;
    /** Callback "Обратная связь" в user-dropdown */
    onFeedback?: (() => void) | null;
    /** Callback "Админ-панель" — показывается только если задан */
    onAdmin?: (() => void) | null;
    /** Callback "Сохранить" в File-меню */
    onSave?: (() => void) | null;
    /** Callback "Сохранить как" в File-меню */
    onSaveAs?: (() => void) | null;
    /** Callback "Открыть" в File-меню */
    onOpen?: (() => void) | null;
}

/**
 * Шапка страницы notebook'а: логотип (клик → /files), имя файла с inline-rename
 * (для владельца), action-кнопки (избранное/облако/share), user-pill с dropdown'ом,
 * File-меню (Открыть/Сохранить/Сохранить как).
 *
 * Особенности rename: Enter — commit (через blur → #finishEditing), Escape —
 * cancel (через AbortController отменяющий blur-обработчик чтобы он не сработал
 * после Escape).
 *
 * При навигации по логотипу (клик) сначала ждёт #finishEditing — чтобы пользователь
 * не потерял изменения имени.
 */
export class NotebookHeader extends BaseComponent {
    #config: NotebookHeaderConfig;
    #onRename: ((newTitle: string) => Promise<void>) | null;
    #onShare: (() => void) | null;
    #originalText = '';
    #isEditing = false;
    #isDropdownOpen = false;
    #isMenuOpen = false;

    /**
     * Создаёт шапку с заданным конфигом.
     * @param parent - родительский элемент
     * @param config - параметры шапки (см. NotebookHeaderConfig)
     */
    public constructor(parent: HTMLElement, config: NotebookHeaderConfig = {}) {
        super(null, parent);
        this.#config = config;
        this.#onRename = config.onRename ?? null;
        this.#onShare = config.onShare ?? null;
        this.#render();
    }

    /**
     * Рендерит шаблон с подготовленными данными (default'ы для filename/user/isOwner).
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = NotebookHeaderTemplate({
            filename: this.#config.filename ?? 'Untitled',
            user: this.#config.user ?? null,
            isOwner: this.#config.isOwner ?? true,
            onAdmin: this.#config.onAdmin ?? null
        });
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит шапку и навешивает все обработчики.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    /**
     * Снимает с DOM.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Программно меняет отображаемое имя файла. Игнорируется во время inline-rename
     * чтобы не затереть редактируемое значение пользователя.
     * @param filename - новое имя
     */
    public setFilename(filename: string): void {
        if (this.#isEditing) return;
        const span = this._element.querySelector('.notebook-header__filename');
        if (span) span.textContent = filename;
    }

    /**
     * Навешивает большой набор обработчиков: клик по логотипу (с финализацией
     * редактирования перед навигацией), edit/share кнопки, File-меню, user-dropdown,
     * клики по action-пунктам с делегированием по data-action.
     */
    #attachEvents(): void {
        const logoLink = nn(this._element.querySelector('.notebook-header__logo-link'));
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this._addListener(logoLink, 'click', async (e: Event) => {
            e.preventDefault();
            await this.#finishEditing();
            nn(Router.getInstance()).navigate('/files');
        });

        const editBtn = this._element.querySelector('.notebook-header__edit-btn');
        if (editBtn) {
            this._addListener(editBtn, 'click', () => {
                this.#startRename();
            });
        }

        const shareBtn = this._element.querySelector('.notebook-header__share-btn');
        if (shareBtn && this.#onShare) {
            this._addListener(shareBtn, 'click', () => {
                nn(this.#onShare)();
            });
        }

        const menuBtn = this._element.querySelector('[data-menu="file"]');
        if (menuBtn) {
            this._addListener(menuBtn, 'click', (e: Event) => {
                e.stopPropagation();
                this.#toggleMenu();
            });

            this._addListener(document, 'click', () => {
                if (this.#isMenuOpen) this.#closeMenu();
            });
        }

        const fileDropdown = this._element.querySelector('.notebook-header__dropdown');
        if (fileDropdown) {
            this._addListener(fileDropdown, 'click', (e: Event) => {
                e.stopPropagation();
                const item = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
                if (!item) return;
                const action = item.dataset.action;
                if (action === 'save' && this.#config.onSave) this.#config.onSave();
                else if (action === 'save-as' && this.#config.onSaveAs) this.#config.onSaveAs();
                else if (action === 'open' && this.#config.onOpen) this.#config.onOpen();
                this.#closeMenu();
            });
        }

        const pill = this._element.querySelector('.notebook-header__user-pill');
        if (pill) {
            this._addListener(pill, 'click', (e: Event) => {
                e.stopPropagation();
                this.#toggleDropdown();
            });

            this._addListener(document, 'click', () => {
                if (this.#isDropdownOpen) this.#closeDropdown();
            });

            const dropdown = this._element.querySelector('.notebook-header__user-dropdown');
            if (dropdown) {
                this._addListener(dropdown, 'click', (e: Event) => {
                    e.stopPropagation();
                    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
                    if (!item) return;
                    const action = item.dataset.action;
                    if (action === 'profile' && this.#config.onProfile) {
                        this.#config.onProfile();
                    } else if (action === 'admin' && this.#config.onAdmin) {
                        this.#config.onAdmin();
                    } else if (action === 'feedback' && this.#config.onFeedback) {
                        this.#config.onFeedback();
                    } else if (action === 'logout' && this.#config.onLogout) {
                        this.#config.onLogout();
                    }
                    this.#closeDropdown();
                });
            }
        }
    }

    /**
     * Показывает анимацию сохранения на иконке "Облако". Класс снимается ровно
     * по событию animationend, что устраняет рассинхрон между CSS-анимацией
     * (3 цикла @ 0.5s) и таймером — пользователь больше не увидит застывших
     * промежуточных состояний.
     */
    public showSaveIndicator(): void {
        const cloudBtn = this._element.querySelector('[title="Облако"]');
        if (!cloudBtn) return;
        const onEnd = (): void => {
            cloudBtn.classList.remove('notebook-header__icon-btn--saving');
            cloudBtn.removeEventListener('animationend', onEnd);
        };
        cloudBtn.addEventListener('animationend', onEnd);
        cloudBtn.classList.add('notebook-header__icon-btn--saving');
    }

    /**
     * Финализирует inline-rename: убирает contenteditable, читает новое значение.
     * Если пусто — восстанавливает оригинал; если изменилось и есть onRename —
     * вызывает callback и ждёт его завершения. Безопасно вызывать когда
     * редактирование не активно — лишний noop.
     */
    async #finishEditing(): Promise<void> {
        if (!this.#isEditing) return;

        const filenameSpan = nn(
            this._element.querySelector<HTMLElement>('.notebook-header__filename')
        );
        this.#isEditing = false;
        filenameSpan.contentEditable = 'false';
        filenameSpan.classList.remove('notebook-header__filename--editing');

        const newTitle = (filenameSpan.textContent || '').trim();
        if (!newTitle) {
            filenameSpan.textContent = this.#originalText;
        } else if (newTitle !== this.#originalText && this.#onRename) {
            await this.#onRename(newTitle);
        }
    }

    /**
     * Переключает состояние File-меню.
     */
    #toggleMenu(): void {
        if (this.#isMenuOpen) {
            this.#closeMenu();
        } else {
            this.#openMenu();
        }
    }

    /**
     * Открывает File-меню (CSS-класс на dropdown'е и активная подсветка триггера).
     */
    #openMenu(): void {
        this.#isMenuOpen = true;
        nn(this._element.querySelector('.notebook-header__dropdown')).classList.add(
            'notebook-header__dropdown--open'
        );
        nn(this._element.querySelector('[data-menu="file"]')).classList.add(
            'notebook-header__menu-item--active'
        );
    }

    /**
     * Закрывает File-меню.
     */
    #closeMenu(): void {
        this.#isMenuOpen = false;
        nn(this._element.querySelector('.notebook-header__dropdown')).classList.remove(
            'notebook-header__dropdown--open'
        );
        nn(this._element.querySelector('[data-menu="file"]')).classList.remove(
            'notebook-header__menu-item--active'
        );
    }

    /**
     * Переключает состояние user-dropdown'а.
     */
    #toggleDropdown(): void {
        if (this.#isDropdownOpen) {
            this.#closeDropdown();
        } else {
            this.#openDropdown();
        }
    }

    /**
     * Открывает user-dropdown.
     */
    #openDropdown(): void {
        this.#isDropdownOpen = true;
        nn(this._element.querySelector('.notebook-header__user-dropdown')).classList.add(
            'header-user-dropdown_visible'
        );
    }

    /**
     * Закрывает user-dropdown.
     */
    #closeDropdown(): void {
        this.#isDropdownOpen = false;
        nn(this._element.querySelector('.notebook-header__user-dropdown')).classList.remove(
            'header-user-dropdown_visible'
        );
    }

    /**
     * Запускает inline-rename: делает span contenteditable, выделяет текст,
     * подписывается на keydown (Enter — commit через blur, Escape — cancel
     * через AbortController) и blur (commit через #finishEditing).
     *
     * AbortController нужен потому что Escape должен ОТМЕНИТЬ редактирование
     * без вызова finishEditing — abort сигнализирует обоим listener'ам что
     * их работа больше не нужна.
     */
    #startRename(): void {
        const filenameSpan = nn(
            this._element.querySelector<HTMLElement>('.notebook-header__filename')
        );
        this.#originalText = filenameSpan.textContent || '';
        this.#isEditing = true;

        filenameSpan.contentEditable = 'true';
        filenameSpan.classList.add('notebook-header__filename--editing');
        filenameSpan.focus();

        const range = document.createRange();
        range.selectNodeContents(filenameSpan);
        const sel = nn(window.getSelection());
        sel.removeAllRanges();
        sel.addRange(range);

        const controller = new AbortController();

        filenameSpan.addEventListener(
            'keydown',
            (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    filenameSpan.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    controller.abort();
                    this.#isEditing = false;
                    filenameSpan.contentEditable = 'false';
                    filenameSpan.classList.remove('notebook-header__filename--editing');
                    filenameSpan.textContent = this.#originalText;
                }
            },
            { signal: controller.signal }
        );

        filenameSpan.addEventListener(
            'blur',
            () => {
                controller.abort();
                void this.#finishEditing();
            },
            { signal: controller.signal }
        );
    }
}
