import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { Router } from '../../shared/router/Router.js';
import { NotebookHeaderTemplate } from './NotebookHeader.template.js';
import { nn } from '../../shared/utils/notNull.js';

interface NotebookHeaderConfig {
    filename?: string;
    user?: {
        avatarUrl?: string;
        initials: string;
        username: string;
    } | null;
    isOwner?: boolean;
    onRename?: ((newTitle: string) => Promise<void>) | null;
    onShare?: (() => void) | null;
    onProfile?: (() => void) | null;
    onLogout?: (() => void) | null;
    onFeedback?: (() => void) | null;
    onAdmin?: (() => void) | null;
    onSave?: (() => void) | null;
    onSaveAs?: (() => void) | null;
    onOpen?: (() => void) | null;
}

export class NotebookHeader extends BaseComponent {
    #config: NotebookHeaderConfig;
    #onRename: ((newTitle: string) => Promise<void>) | null;
    #onShare: (() => void) | null;
    #originalText = '';
    #isEditing = false;
    #isDropdownOpen = false;
    #isMenuOpen = false;

    public constructor(parent: HTMLElement, config: NotebookHeaderConfig = {}) {
        super(null, parent);
        this.#config = config;
        this.#onRename = config.onRename ?? null;
        this.#onShare = config.onShare ?? null;
        this.#render();
    }

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

    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#attachEvents();
    }

    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    public setFilename(filename: string): void {
        if (this.#isEditing) return;
        const span = this._element.querySelector('.notebook-header__filename');
        if (span) span.textContent = filename;
    }

    #attachEvents(): void {
        const logoLink = nn(this._element.querySelector('.notebook-header__logo-link'));
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this._addListener(logoLink, 'click', async (e: Event) => {
            e.preventDefault();
            await this.#finishEditing();
            nn(Router.getInstance()).navigate('/files');
        });

        const editBtn = nn(this._element.querySelector('.notebook-header__edit-btn'));
        this._addListener(editBtn, 'click', () => {
            this.#startRename();
        });

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
                    const item = (e.target as HTMLElement).closest('[data-action]');
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

    public showSaveIndicator(): void {
        const cloudBtn = this._element.querySelector('[title="Облако"]');
        if (!cloudBtn) return;
        cloudBtn.classList.add('notebook-header__icon-btn--saving');
        setTimeout(() => {
            cloudBtn.classList.remove('notebook-header__icon-btn--saving');
        }, 1500);
    }

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

    #toggleMenu(): void {
        if (this.#isMenuOpen) {
            this.#closeMenu();
        } else {
            this.#openMenu();
        }
    }

    #openMenu(): void {
        this.#isMenuOpen = true;
        nn(this._element.querySelector('.notebook-header__dropdown')).classList.add(
            'notebook-header__dropdown--open'
        );
        nn(this._element.querySelector('[data-menu="file"]')).classList.add(
            'notebook-header__menu-item--active'
        );
    }

    #closeMenu(): void {
        this.#isMenuOpen = false;
        nn(this._element.querySelector('.notebook-header__dropdown')).classList.remove(
            'notebook-header__dropdown--open'
        );
        nn(this._element.querySelector('[data-menu="file"]')).classList.remove(
            'notebook-header__menu-item--active'
        );
    }

    #toggleDropdown(): void {
        if (this.#isDropdownOpen) {
            this.#closeDropdown();
        } else {
            this.#openDropdown();
        }
    }

    #openDropdown(): void {
        this.#isDropdownOpen = true;
        nn(this._element.querySelector('.notebook-header__user-dropdown')).classList.add(
            'header-user-dropdown_visible'
        );
    }

    #closeDropdown(): void {
        this.#isDropdownOpen = false;
        nn(this._element.querySelector('.notebook-header__user-dropdown')).classList.remove(
            'header-user-dropdown_visible'
        );
    }

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
