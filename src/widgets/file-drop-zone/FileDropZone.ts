import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { nn } from '../../shared/utils/notNull.js';
import { FileDropZoneTemplate } from './FileDropZone.template.js';

/**
 * Опции FileDropZone — список колбэков для родителя (DiskPage).
 */
export interface FileDropZoneOptions {
    /**
     * Колбэк вызывается с массивом File после выбора файлов через диалог
     * или после drop. Родитель должен загрузить файлы и обновить UI.
     * @param files - выбранные пользователем файлы
     */
    onFiles: (files: File[]) => Promise<void>;
}

/**
 * Виджет drag-and-drop зоны для загрузки файлов. Слушает dragenter/dragover/
 * dragleave/drop на корневом элементе, click на кнопке "Выбрать файл" и change
 * на скрытом input. Сам не загружает файлы — отдаёт массив File в колбэк.
 *
 * Состояние (loading/ok/error) меняет текст блока .file-drop-zone__status —
 * для базовой обратной связи. Прогресс загрузки не показывает, потому что
 * HttpClient.upload() не отдаёт ProgressEvent.
 */
export class FileDropZone extends BaseComponent {
    #options: FileDropZoneOptions;
    #dragCounter = 0;

    /**
     * Создаёт виджет и сразу подготавливает DOM (innerHTML).
     * Реальная вставка в родителя происходит в mount().
     * @param parent - родительский DOM-элемент
     * @param options - опции с колбэком onFiles
     */
    public constructor(parent: HTMLElement, options: FileDropZoneOptions) {
        const root = document.createElement('div');
        root.innerHTML = FileDropZoneTemplate();
        super(root.firstElementChild as HTMLElement, parent);
        this.#options = options;
    }

    /**
     * Монтирует виджет и развешивает слушатели drag/drop/click/change.
     * Должен вызываться один раз — повторный mount без unmount даст дубль
     * слушателей.
     */
    public override mount(): void {
        super.mount();

        const root = this._element;
        const button = nn(root.querySelector<HTMLButtonElement>('.file-drop-zone__button'));
        const input = nn(root.querySelector<HTMLInputElement>('.file-drop-zone__input'));

        this._addListener(button, 'click', () => {
            input.click();
        });
        this._addListener(input, 'change', () => {
            this.#handleInputChange(input);
        });

        this._addListener(root, 'dragenter', this.#onDragEnter as EventListener);
        this._addListener(root, 'dragover', this.#onDragOver as EventListener);
        this._addListener(root, 'dragleave', this.#onDragLeave as EventListener);
        this._addListener(root, 'drop', this.#onDrop as EventListener);
    }

    /**
     * Устанавливает текст статуса под кнопкой и подсвечивает его цветом.
     * Используется родителем для сообщений об ошибках/успехе после загрузки.
     * @param text - текст сообщения (пустая строка чтобы скрыть)
     * @param level - 'ok' / 'error' / 'info' (по умолчанию 'info')
     */
    public setStatus(text: string, level: 'ok' | 'error' | 'info' = 'info'): void {
        const status = this._element.querySelector<HTMLElement>('.file-drop-zone__status');
        if (!status) return;
        status.textContent = text;
        status.classList.remove('file-drop-zone__status_ok', 'file-drop-zone__status_error');
        if (level === 'ok') status.classList.add('file-drop-zone__status_ok');
        if (level === 'error') status.classList.add('file-drop-zone__status_error');
    }

    /**
     * Обрабатывает change на скрытом input: вытаскивает FileList, очищает
     * input.value (чтобы повторный выбор того же файла снова триггерил change)
     * и отдаёт массив File в колбэк onFiles.
     * @param input - элемент input из которого читаются файлы
     */
    #handleInputChange(input: HTMLInputElement): void {
        const list = input.files;
        if (!list || list.length === 0) return;
        const files = Array.from(list);
        input.value = '';
        void this.#options.onFiles(files);
    }

    /**
     * Реакция на dragenter: считает уровень вложенности (счётчик нужен,
     * потому что dragenter/dragleave стреляют на каждом дочернем элементе),
     * подсвечивает зону.
     * @param event - DragEvent
     */
    #onDragEnter = (event: DragEvent): void => {
        event.preventDefault();
        this.#dragCounter += 1;
        this._element.classList.add('file-drop-zone_dragover');
    };

    /**
     * Реакция на dragover: блокирует дефолт чтобы получить событие drop.
     * @param event - DragEvent
     */
    #onDragOver = (event: DragEvent): void => {
        event.preventDefault();
    };

    /**
     * Реакция на dragleave: уменьшает счётчик; когда он обнулится — снимает
     * подсветку. Так избегаем «прыжков» при пересечении границ дочерних
     * элементов.
     * @param event - DragEvent
     */
    #onDragLeave = (event: DragEvent): void => {
        event.preventDefault();
        this.#dragCounter = Math.max(0, this.#dragCounter - 1);
        if (this.#dragCounter === 0) {
            this._element.classList.remove('file-drop-zone_dragover');
        }
    };

    /**
     * Реакция на drop: вытаскивает файлы из dataTransfer, сбрасывает счётчик
     * и подсветку, отдаёт массив в onFiles.
     * @param event - DragEvent
     */
    #onDrop = (event: DragEvent): void => {
        event.preventDefault();
        this.#dragCounter = 0;
        this._element.classList.remove('file-drop-zone_dragover');
        const list = event.dataTransfer?.files;
        if (!list || list.length === 0) return;
        void this.#options.onFiles(Array.from(list));
    };
}
