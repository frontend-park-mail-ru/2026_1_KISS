import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import type { FileItemDTO } from '../../shared/api/types.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { formatBytes } from '../../shared/utils/formatBytes.js';
import { nn } from '../../shared/utils/notNull.js';
import { DiskTableTemplate } from './DiskTable.template.js';

/**
 * Опции DiskTable — колбэки на действия со строкой. Родитель сам подтверждает
 * деструктивные действия и вызывает соответствующие методы StorageApi.
 */
export interface DiskTableOptions {
    /**
     * Колбэк удаления строки.
     * @param file - файл, на котором был клик
     */
    onDelete: (file: FileItemDTO) => void;
    /**
     * Колбэк открытия модалки шаринга. Опционален: на вкладке «расшарено
     * со мной» не показываем кнопку «Поделиться».
     * @param file - файл, для которого открыть ShareModal
     */
    onShare?: (file: FileItemDTO) => void;
    /**
     * Колбэк переименования. Опционален аналогично onShare.
     * @param file - файл к переименованию
     */
    onRename?: (file: FileItemDTO) => void;
    /**
     * Режим отображения. 'own' — мои файлы (полный набор действий);
     * 'shared' — файлы, расшаренные мне (только скачивание, без удаления/шаринга).
     */
    mode?: 'own' | 'shared';
}

/**
 * Таблица файлов: имя, размер, тип, число скачиваний, дата, действия.
 * setData(files) пересобирает tbody; владельцу доступны действия
 * Скачать/Поделиться/Переименовать/Удалить. На вкладке «расшарено со мной»
 * показывается только Скачать (или disabled, если уровень view).
 */
export class DiskTable extends BaseComponent {
    #options: DiskTableOptions;
    #files: FileItemDTO[] = [];

    /**
     * Создаёт виджет; реальная вставка в DOM — в mount().
     * @param parent - родительский DOM-элемент
     * @param options - опции с колбэками
     */
    public constructor(parent: HTMLElement, options: DiskTableOptions) {
        const root = document.createElement('div');
        root.innerHTML = DiskTableTemplate();
        super(root.firstElementChild as HTMLElement, parent);
        this.#options = options;
    }

    /**
     * Заменяет список файлов и перерисовывает tbody.
     * @param files - новый список файлов
     */
    public setData(files: FileItemDTO[]): void {
        this.#files = files;
        this.#renderRows();
    }

    /**
     * Пересобирает tbody таблицы из текущего this.#files.
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
        const isShared = this.#options.mode === 'shared';
        body.innerHTML = this.#files.map((file) => this.#renderRow(file, isShared)).join('');
        this.#attachRowListeners(body);
    }

    /**
     * Возвращает HTML одной строки.
     * @param file - DTO файла
     * @param isShared - режим вкладки «расшарено со мной»
     * @returns HTML-разметка <tr>
     */
    #renderRow(file: FileItemDTO, isShared: boolean): string {
        const sizeStr = formatBytes(file.size);
        const dateStr = new Date(file.created_at).toLocaleString('ru-RU');
        const safeName = escapeHtml(file.filename);
        const safeMime = escapeHtml(file.mime_type);
        const safeDownload = escapeHtml(file.download_url);
        const downloadsBadge =
            file.downloads_count > 0
                ? `<span class="disk-table__badge disk-table__badge_count" title="Скачиваний">${String(
                      file.downloads_count
                  )}</span>`
                : '';
        const publicBadge = file.is_public
            ? '<span class="disk-table__badge disk-table__badge_public" title="Доступно по публичной ссылке">Публичный</span>'
            : '';

        const actions = isShared
            ? this.#renderSharedActions(file, safeDownload)
            : this.#renderOwnActions(safeDownload);

        return `<tr class="disk-table__row" data-id="${escapeHtml(file.id)}">
            <td class="disk-table__name">
                <a href="${safeDownload}" target="_blank" rel="noopener noreferrer">${safeName}</a>
                ${publicBadge}
            </td>
            <td>${sizeStr}</td>
            <td>${safeMime}</td>
            <td class="disk-table__downloads">${downloadsBadge}</td>
            <td>${dateStr}</td>
            <td class="disk-table__actions">${actions}</td>
        </tr>`;
    }

    /**
     * Возвращает HTML действий для строк на вкладке «Мои файлы».
     * @param downloadUrl - экранированный download_url
     * @returns HTML-разметка действий
     */
    #renderOwnActions(downloadUrl: string): string {
        const share = this.#options.onShare
            ? `<button type="button" class="disk-table__action" data-action="share">Поделиться</button>`
            : '';
        const rename = this.#options.onRename
            ? `<button type="button" class="disk-table__action" data-action="rename">Переименовать</button>`
            : '';
        return `
            <a class="disk-table__action" href="${downloadUrl}" download>Скачать</a>
            ${share}
            ${rename}
            <button type="button" class="disk-table__action disk-table__action_delete" data-action="delete">Удалить</button>
        `;
    }

    /**
     * Возвращает HTML действий для строк на вкладке «Расшарено со мной».
     * View-only уровень — кнопка disabled с подсказкой.
     * @param file - DTO файла
     * @param downloadUrl - экранированный download_url
     * @returns HTML-разметка действий
     */
    #renderSharedActions(file: FileItemDTO, downloadUrl: string): string {
        if (file.your_permission === 'download') {
            return `<a class="disk-table__action" href="${downloadUrl}" download>Скачать</a>`;
        }
        return `<button type="button" class="disk-table__action" disabled title="У вас только просмотр">Только просмотр</button>`;
    }

    /**
     * Навешивает делегирование обработчиков на tbody — каждый клик по
     * data-action="X" вызывает соответствующий callback.
     * @param body - tbody таблицы
     */
    #attachRowListeners(body: HTMLElement): void {
        this._addListener(body, 'click', (event: Event) => {
            const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
            if (!btn) return;
            const row = btn.closest<HTMLElement>('.disk-table__row');
            if (!row) return;
            const id = row.dataset.id ?? '';
            const file = this.#files.find((f) => f.id === id);
            if (!file) return;
            const action = btn.dataset.action;
            if (action === 'delete') this.#options.onDelete(file);
            else if (action === 'share') this.#options.onShare?.(file);
            else if (action === 'rename') this.#options.onRename?.(file);
        });
    }
}
