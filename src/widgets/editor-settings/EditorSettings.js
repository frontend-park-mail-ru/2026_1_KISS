import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { EditorSettingsTemplate } from './EditorSettings.template.js';

const STORAGE_KEY = 'kisscolab_editor';

/**
 * EditorSettings provides controls for editor preferences
 * stored in localStorage (font size, tab size).
 * @extends BaseComponent
 */
export class EditorSettings extends BaseComponent {
    /**
     * @param {HTMLElement} parent - container element
     */
    constructor(parent) {
        super(null, parent);
        this.#render();
    }

    /**
     * Renders the section from the Handlebars template.
     */
    #render() {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = EditorSettingsTemplate();
        this._element = tempContainer.firstElementChild;
    }

    /**
     * Mounts the component, loads saved settings, and attaches change events.
     */
    mount() {
        if (this._isMounted) return;
        super.mount();
        this.#loadSettings();
        this.#attachEvents();
    }

    /**
     * Loads saved settings from localStorage and applies them to the selects.
     */
    #loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!saved) return;

            const selects = this._element.querySelectorAll('.editor-settings__select');
            selects.forEach((select) => {
                const key = select.dataset.setting;
                if (saved[key]) {
                    select.value = saved[key];
                }
            });
        } catch (_e) {
            /* ignore parse errors */
        }
    }

    /**
     * Attaches change event listeners to all select elements.
     */
    #attachEvents() {
        const selects = this._element.querySelectorAll('.editor-settings__select');
        const msgEl = this._element.querySelector('.editor-settings__saved-msg');

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

    /**
     * Saves current select values to localStorage.
     */
    #saveSettings() {
        const selects = this._element.querySelectorAll('.editor-settings__select');
        const settings = {};
        selects.forEach((select) => {
            settings[select.dataset.setting] = select.value;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
}
