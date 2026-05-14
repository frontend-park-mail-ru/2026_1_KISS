import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { StorageApi } from '../../shared/api/StorageApi.js';
import { logError } from '../../shared/utils/logger.js';
import { nn } from '../../shared/utils/notNull.js';
import { RenameModalTemplate } from './RenameModal.template.js';
import type { FileItemDTO } from '../../shared/api/types.js';

/**
 * Singleton-модалка переименования файла. Открывается одним методом open(file),
 * принимает новое имя из инпута, валидирует и вызывает StorageApi.renameFile.
 * При успехе вызывает onSave-коллбек (для обновления родительской таблицы).
 */
export class RenameModal extends BaseComponent {
    static #instance: RenameModal | null = null;
    #file: FileItemDTO | null = null;
    #storage: StorageApi;
    #onSave: ((file: FileItemDTO) => void) | null = null;

    /**
     * Создаёт singleton (через getInstance).
     */
    public constructor() {
        super(null, document.body);
        this.#storage = StorageApi.getInstance();
    }

    /**
     * Возвращает singleton-экземпляр.
     * @returns единственный экземпляр RenameModal
     */
    public static getInstance(): RenameModal {
        RenameModal.#instance ??= new RenameModal();
        return RenameModal.#instance;
    }

    /**
     * Открывает модалку: рендерит UI, маунтит, фокусирует input.
     * @param file - DTO файла для переименования
     * @param onSave - коллбек с обновлённым DTO после успешного rename
     */
    public open(file: FileItemDTO, onSave: (file: FileItemDTO) => void): void {
        this.#file = file;
        this.#onSave = onSave;
        const tmp = document.createElement('div');
        tmp.innerHTML = RenameModalTemplate(file.filename);
        this._element = tmp.firstElementChild as HTMLElement;
        this.#attachEvents();
        super.mount();
        document.body.style.overflow = 'hidden';
        const input = nn(this._element.querySelector<HTMLInputElement>('.rename-modal__input'));
        input.focus();
        input.select();
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
     * Переопределение базового mount: noop. Реальный монтаж делается из open().
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
     * Навешивает обработчики: закрытие (overlay/Escape/X/Cancel), сохранение
     * (Enter/Save).
     */
    #attachEvents(): void {
        this._addListener(
            this._element.querySelector('.rename-modal__overlay'),
            'click',
            (e: Event) => {
                if (e.target === e.currentTarget) this.close();
            }
        );
        this._addListener(this._element.querySelector('.rename-modal__close-btn'), 'click', () => {
            this.close();
        });
        this._addListener(this._element.querySelector('.rename-modal__cancel-btn'), 'click', () => {
            this.close();
        });
        this._addListener(document, 'keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Escape') this.close();
        });

        const input = nn(this._element.querySelector<HTMLInputElement>('.rename-modal__input'));
        const saveBtn = nn(
            this._element.querySelector<HTMLButtonElement>('.rename-modal__save-btn')
        );
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async event handler
        this._addListener(saveBtn, 'click', () => this.#handleSave(input.value));
        this._addListener(input, 'keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Enter') void this.#handleSave(input.value);
        });
    }

    /**
     * Валидирует имя и сохраняет на бэк. При ошибке показывает текст.
     * @param raw - значение из input
     */
    async #handleSave(raw: string): Promise<void> {
        const file = nn(this.#file);
        const name = raw.trim();
        if (!name) {
            this.#showError('Имя не может быть пустым');
            return;
        }
        if (name.length > 255) {
            this.#showError('Имя слишком длинное (максимум 255)');
            return;
        }
        if (/[/\\]/.test(name)) {
            this.#showError('Имя не должно содержать символы / и \\');
            return;
        }
        if (name === file.filename) {
            this.close();
            return;
        }
        const saveBtn = nn(
            this._element.querySelector<HTMLButtonElement>('.rename-modal__save-btn')
        );
        saveBtn.disabled = true;
        try {
            const updated = await this.#storage.renameFile(file.id, name);
            this.#onSave?.(updated);
            this.close();
        } catch (error) {
            logError('RenameModal.save failed', error);
            const msg = error instanceof Error ? error.message : 'Не удалось переименовать';
            this.#showError(msg);
            saveBtn.disabled = false;
        }
    }

    /**
     * Показывает текст ошибки.
     * @param msg - сообщение
     */
    #showError(msg: string): void {
        const el = this._element.querySelector<HTMLElement>('.rename-modal__error');
        if (!el) return;
        el.textContent = msg;
        el.hidden = false;
    }
}
