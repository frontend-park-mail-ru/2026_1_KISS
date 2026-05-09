import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { EditorSettingsTemplate } from './EditorSettings.template.js';
import { nn } from '../../shared/utils/notNull.js';

const STORAGE_KEY = 'kisscolab_editor';

export class EditorSettings extends BaseComponent {
    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = EditorSettingsTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#loadSettings();
        this.#attachEvents();
    }

    #loadSettings(): void {
        try {
            const saved = JSON.parse(
                nn(localStorage.getItem(STORAGE_KEY))
            ) as Record<string, string> | null;
            if (!saved) return;

            const selects = this._element.querySelectorAll<HTMLSelectElement>(
                '.editor-settings__select'
            );
            selects.forEach((select) => {
                const key = nn(select.dataset.setting);
                const value = saved[key];
                if (value !== undefined) {
                    select.value = value;
                }
            });
        } catch (_e) {
            /* ignore parse errors */
        }
    }

    #attachEvents(): void {
        const selects = this._element.querySelectorAll<HTMLSelectElement>(
            '.editor-settings__select'
        );
        const msgEl = nn(this._element.querySelector('.editor-settings__saved-msg'));

        selects.forEach((select) => {
            this._addListener(select, 'change', () => {
                this.#saveSettings();
                msgEl.textContent = 'Настройки сохранены';
                setTimeout(() => {
                    msgEl.textContent = '';
                }, 2000);
            });
        });
    }

    #saveSettings(): void {
        const selects = this._element.querySelectorAll<HTMLSelectElement>(
            '.editor-settings__select'
        );
        const settings: Record<string, string> = {};
        selects.forEach((select) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            settings[select.dataset.setting!] = select.value;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
}
