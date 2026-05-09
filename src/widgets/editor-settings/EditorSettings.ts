import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { EditorSettingsTemplate } from './EditorSettings.template.js';
import { nn } from '../../shared/utils/notNull.js';

const STORAGE_KEY = 'kisscolab_editor';

/**
 * Панель настроек редактора (размер шрифта, размер табуляции). Сохраняет
 * выбор пользователя в localStorage по STORAGE_KEY и подгружает при mount.
 * Показывает кратковременное сообщение "Настройки сохранены" после изменения.
 */
export class EditorSettings extends BaseComponent {
    /**
     * Создаёт и рендерит панель.
     * @param parent - родительский элемент
     */
    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер.
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = EditorSettingsTemplate();
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит панель, восстанавливает значения из localStorage и навешивает
     * обработчики change на все select'ы.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#loadSettings();
        this.#attachEvents();
    }

    /**
     * Восстанавливает значения select'ов из localStorage. Молча игнорирует
     * парс-ошибки (например если ключ был испорчен) — просто оставляет
     * дефолтные selected из шаблона.
     */
    #loadSettings(): void {
        try {
            const saved = JSON.parse(nn(localStorage.getItem(STORAGE_KEY))) as Record<
                string,
                string
            > | null;
            if (!saved) return;

            const selects = this._element.querySelectorAll<HTMLSelectElement>(
                '.editor-settings__select'
            );
            selects.forEach((select) => {
                const key = nn(select.dataset.setting);
                if (Object.hasOwn(saved, key)) {
                    select.value = saved[key];
                }
            });
        } catch (_e) {
            /* ignore parse errors */
        }
    }

    /**
     * Навешивает change-обработчики: каждое изменение сохраняет всё, и показывает
     * подтверждающее сообщение на 2 секунды.
     */
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

    /**
     * Сериализует все select'ы в одно значение localStorage. Использует
     * data-setting атрибут как ключ.
     */
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
