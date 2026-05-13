import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import type { FileItemDTO } from '../../shared/api/types.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { formatBytes } from '../../shared/utils/formatBytes.js';
import { nn } from '../../shared/utils/notNull.js';
import { DiskTableTemplate } from './DiskTable.template.js';

/**
 * Опции DiskTable — колбэк на удаление одной строки. Родитель обрабатывает
 * подтверждение и сам зовёт StorageApi.deleteFile.
 */
export interface DiskTableOptions {
    /**
     * Колбэк вызывается при клике на «Удалить». Родитель должен спросить
     * подтверждение (если нужно) и удалить файл через StorageApi, после чего
     * обновить таблицу через setData.
     * @param file - файл, на котором был клик
     */
    onDelete: (file: FileItemDTO) => void;
}

/**
 * Таблица пользовательских файлов с колонками Имя/Размер/Тип/Дата/Действия.
 * Логика — простой setData(files) пересобирает tbody. Сортировка пока не нужна:
 * данные приходят с бэка уже отсортированные по created_at DESC.
 */
export class DiskTable extends BaseComponent {
    #options: DiskTableOptions;
    #files: FileItemDTO[] = [];

    /**
     * Создаёт виджет; реальная вставка в DOM — в mount().
     * @param parent - родительский DOM-элемент
     * @param options - опции с колбэком onDelete
     */
    public constructor(parent: HTMLElement, options: DiskTableOptions) {
        const root = document.createElement('div');
        root.innerHTML = DiskTableTemplate();
        super(root.firstElementChild as HTMLElement, parent);
        this.#options = options;
    }

    /**
     * Заменяет список файлов и перерисовывает tbody. Empty-state показывается
     * автоматически когда files.length === 0.
     * @param files - новый список файлов
     */
    public setData(files: FileItemDTO[]): void {
        this.#files = files;
        this.#renderRows();
    }

    /**
     * Пересобирает tbody таблицы из текущего this.#files. Слушатели для
     * кнопок удаления навешиваются заново (предыдущие чистятся в
     * _clearListeners при unmount; здесь мы переиспользуем _listeners).
     */
    #renderRows(): void {
        const body = nn(this._element.querySelector<HTMLElement>('.disk-table__body'));
        const empty = nn(this._element.querySelector<HTMLElement>('.disk-table__empty'));

        if (this.#files.length === 0) {
            body.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        body.innerHTML = this.#files
            .map((file) => {
                const sizeStr = formatBytes(file.size);
                const dateStr = new Date(file.created_at).toLocaleString('ru-RU');
                const safeName = escapeHtml(file.filename);
                const safeMime = escapeHtml(file.mime_type);
                const safeUrl = escapeHtml(file.url);
                return `<tr class="disk-table__row" data-id="${escapeHtml(file.id)}">
                    <td class="disk-table__name">
                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeName}</a>
                    </td>
                    <td>${sizeStr}</td>
                    <td>${safeMime}</td>
                    <td>${dateStr}</td>
                    <td class="disk-table__actions">
                        <button type="button" class="disk-table__action disk-table__action_delete" data-action="delete">Удалить</button>
                    </td>
                </tr>`;
            })
            .join('');

        body.querySelectorAll<HTMLButtonElement>('[data-action="delete"]').forEach((btn) => {
            this._addListener(btn, 'click', (event: Event) => {
                const row = (event.currentTarget as HTMLElement).closest<HTMLElement>(
                    '.disk-table__row'
                );
                if (!row) return;
                const id = row.dataset.id ?? '';
                const file = this.#files.find((f) => f.id === id);
                if (file) this.#options.onDelete(file);
            });
        });
    }
}
