import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { EditorSettingsTemplate } from './EditorSettings.template.js';

const STORAGE_KEY = 'kisscolab_editor';

export class EditorSettings extends BaseComponent {
    constructor(parent: HTMLElement) {
        super(null, parent);
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = EditorSettingsTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#loadSettings();
        this.#attachEvents();
    }

    #loadSettings(): void {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
            if (!saved) return;

            const selects = this._element.querySelectorAll<HTMLSelectElement>(
                '.editor-settings__select'
            );
            selects.forEach((select) => {
                const key = select.dataset.setting as string;
                if (saved[key]) {
                    select.value = saved[key];
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
        const msgEl = this._element.querySelector('.editor-settings__saved-msg') as HTMLElement;

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
            settings[select.dataset.setting as string] = select.value;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
}
