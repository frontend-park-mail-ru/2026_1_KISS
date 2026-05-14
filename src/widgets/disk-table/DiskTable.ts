import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import type { FileItemDTO } from '../../shared/api/types.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { formatBytes } from '../../shared/utils/formatBytes.js';
import { nn } from '../../shared/utils/notNull.js';
import { DiskTableTemplate } from './DiskTable.template.js';

/**
 * Опции DiskTable — колбэки на действия. Все действия вызываются из
 * контекстного меню (правая кнопка мыши на строке). Видимый набор зависит
 * от прав текущего пользователя на конкретный файл: owner получает все
 * действия, приглашённый с уровнем 'download' — только «Скачать»,
 * приглашённый с уровнем 'view' — disabled-пункт-подсказку.
 */
export interface DiskTableOptions {
    /**
     * Колбэк удаления файла. Вызывается только для owner.
     * @param file - файл к удалению
     */
    onDelete: (file: FileItemDTO) => void;
    /**
     * Колбэк открытия модалки шаринга. Вызывается только для owner.
     * @param file - файл для шаринга
     */
    onShare?: (file: FileItemDTO) => void;
    /**
     * Колбэк переименования. Вызывается только для owner.
     * @param file - файл к переименованию
     */
    onRename?: (file: FileItemDTO) => void;
}

/**
 * Описание одного пункта контекстного меню. Действия маппятся в
 * соответствующие колбэки DiskTableOptions.
 */
interface ContextMenuItem {
    /** Видимая подпись пункта */
    label: string;
    /** Идентификатор действия для роутинга в обработчик */
    action: 'download' | 'share' | 'rename' | 'delete';
    /** Стилизовать пункт как деструктивный (красный) */
    danger?: boolean;
    /** Заблокирован ли пункт */
    disabled?: boolean;
    /** Tooltip-подсказка над пунктом */
    title?: string;
}

/**
 * Таблица файлов с одним общим списком (свои + расшаренные). Колонки:
 * Имя, Владелец, Размер, Тип, Скачиваний, Дата. Длинные значения в первых
 * двух колонках обрезаются ellipsis'ом. Действия — через контекстное меню
 * по правой кнопке мыши.
 */
export class DiskTable extends BaseComponent {
    #options: DiskTableOptions;
    #files: FileItemDTO[] = [];
    #menuEl: HTMLElement | null = null;
    #docClickHandler: ((e: MouseEvent) => void) | null = null;
    #docKeyHandler: ((e: KeyboardEvent) => void) | null = null;

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
     * Размонтирует виджет, закрывает меню и убирает его из DOM (если было создано).
     */
    public override unmount(): void {
        this.#closeMenu();
        if (this.#menuEl !== null) {
            this.#menuEl.remove();
            this.#menuEl = null;
        }
        super.unmount();
    }

    /**
     * Создаёт DOM-элемент меню при первом обращении и аппендит его к body,
     * чтобы position:fixed не упирался ни в overflow ни в transformed-предков.
     * @returns HTMLElement меню (свежесозданный или ранее созданный)
     */
    #ensureMenu(): HTMLElement {
        if (this.#menuEl !== null) return this.#menuEl;
        const el = document.createElement('div');
        el.className = 'disk-table__context-menu';
        el.hidden = true;
        document.body.appendChild(el);
        this.#menuEl = el;
        return el;
    }

    /**
     * Заменяет список файлов и перерисовывает tbody.
     * @param files - новый список (смешанный: свои + расшаренные)
     */
    public setData(files: FileItemDTO[]): void {
        this.#files = files;
        this.#renderRows();
    }

    /**
     * Пересобирает tbody таблицы из текущего this.#files. Внутри ставит
     * делегированные слушатели click и contextmenu на tbody.
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
        body.innerHTML = this.#files.map((file) => this.#renderRow(file)).join('');
        this.#attachRowListeners(body);
    }

    /**
     * Возвращает HTML одной строки.
     * @param file - DTO файла
     * @returns HTML-разметка <tr>
     */
    #renderRow(file: FileItemDTO): string {
        const sizeStr = formatBytes(file.size);
        const dateStr = new Date(file.created_at).toLocaleString('ru-RU');
        const safeName = escapeHtml(file.filename);
        const safeMime = escapeHtml(file.mime_type);
        const safeDownload = escapeHtml(file.download_url);
        const ownerLabel = this.#ownerLabel(file);
        const safeOwner = escapeHtml(ownerLabel);
        const downloadsBadge =
            file.downloads_count > 0
                ? `<span class="disk-table__badge disk-table__badge_count">${String(
                      file.downloads_count
                  )}</span>`
                : '';
        const publicBadge = file.is_public
            ? '<span class="disk-table__badge disk-table__badge_public" title="Доступно по публичной ссылке">Публичный</span>'
            : '';

        return `<tr class="disk-table__row" data-id="${escapeHtml(file.id)}">
            <td class="disk-table__cell-name">
                <div class="disk-table__name-wrap">
                    <a class="disk-table__name-link" href="${safeDownload}" target="_blank" rel="noopener noreferrer" title="${safeName}">${safeName}</a>
                    ${publicBadge}
                </div>
            </td>
            <td class="disk-table__cell-owner" title="${safeOwner}">${safeOwner}</td>
            <td>${sizeStr}</td>
            <td class="disk-table__cell-mime" title="${safeMime}">${safeMime}</td>
            <td class="disk-table__cell-downloads">${downloadsBadge}</td>
            <td class="disk-table__cell-date">${dateStr}</td>
        </tr>`;
    }

    /**
     * Вычисляет подпись владельца: «Я» для собственных файлов (owner или
     * пустой your_permission), иначе email из owner_email или fallback по id.
     * @param file - DTO файла
     * @returns подпись для колонки «Владелец»
     */
    #ownerLabel(file: FileItemDTO): string {
        if (file.your_permission === 'owner' || file.your_permission === undefined) {
            return 'Я';
        }
        if (file.owner_email !== undefined && file.owner_email !== '') {
            return file.owner_email;
        }
        return `Пользователь #${String(file.owner_id)}`;
    }

    /**
     * Навешивает делегирование на tbody: левый клик по имени — нативный
     * download (через <a>), правый клик — контекстное меню.
     * @param body - tbody таблицы
     */
    #attachRowListeners(body: HTMLElement): void {
        this._addListener(body, 'contextmenu', (event: Event) => {
            const e = event as MouseEvent;
            const row = (e.target as HTMLElement).closest<HTMLElement>('.disk-table__row');
            if (!row) return;
            const id = row.dataset.id ?? '';
            const file = this.#files.find((f) => f.id === id);
            if (!file) return;
            e.preventDefault();
            this.#openMenu(file, e.clientX, e.clientY);
        });
    }

    /**
     * Строит и показывает контекстное меню рядом с курсором. Меню
     * позиционируется относительно viewport (position: fixed), его пункты
     * зависят от прав на конкретный файл.
     * @param file - файл, на котором кликнули правой кнопкой
     * @param clientX - координата X курсора
     * @param clientY - координата Y курсора
     */
    #openMenu(file: FileItemDTO, clientX: number, clientY: number): void {
        const menu = this.#ensureMenu();
        const items = this.#buildMenuItems(file);
        menu.innerHTML = items
            .map((item) => {
                const classes = [
                    'disk-table__menu-item',
                    item.danger === true ? 'disk-table__menu-item_danger' : '',
                    item.disabled === true ? 'disk-table__menu-item_disabled' : ''
                ]
                    .filter(Boolean)
                    .join(' ');
                const titleAttr =
                    item.title !== undefined ? ` title="${escapeHtml(item.title)}"` : '';
                return `<button type="button" class="${classes}" data-action="${item.action}" data-id="${escapeHtml(file.id)}"${titleAttr}${item.disabled === true ? ' disabled' : ''}>${escapeHtml(item.label)}</button>`;
            })
            .join('');
        menu.hidden = false;
        const { x, y } = this.#clampMenuPosition(clientX, clientY, menu);
        menu.style.left = `${String(x)}px`;
        menu.style.top = `${String(y)}px`;

        menu.onclick = (event): void => {
            const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
            if (!btn || btn.disabled) return;
            this.#handleMenuAction(file, btn.dataset.action ?? '');
            this.#closeMenu();
        };

        this.#installGlobalCloseListeners();
    }

    /**
     * Собирает список пунктов меню в зависимости от прав на файл.
     * @param file - DTO файла
     * @returns массив пунктов
     */
    #buildMenuItems(file: FileItemDTO): ContextMenuItem[] {
        const isOwner = file.your_permission === 'owner' || file.your_permission === undefined;
        if (isOwner) {
            const items: ContextMenuItem[] = [{ label: 'Скачать', action: 'download' }];
            if (this.#options.onShare) items.push({ label: 'Поделиться', action: 'share' });
            if (this.#options.onRename) items.push({ label: 'Переименовать', action: 'rename' });
            items.push({ label: 'Удалить', action: 'delete', danger: true });
            return items;
        }
        if (file.your_permission === 'view') {
            return [
                {
                    label: 'Только просмотр',
                    action: 'download',
                    disabled: true,
                    title: 'У вас нет права на скачивание'
                }
            ];
        }
        return [{ label: 'Скачать', action: 'download' }];
    }

    /**
     * Корректирует положение меню так, чтобы оно не вылезало за правый/нижний
     * край viewport.
     * @param x - желаемая координата X
     * @param y - желаемая координата Y
     * @param menu - элемент меню (для измерения размеров)
     * @returns скорректированные координаты
     */
    #clampMenuPosition(x: number, y: number, menu: HTMLElement): { x: number; y: number } {
        const rect = menu.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width - 4;
        const maxY = window.innerHeight - rect.height - 4;
        return {
            x: Math.min(x, Math.max(0, maxX)),
            y: Math.min(y, Math.max(0, maxY))
        };
    }

    /**
     * Навешивает глобальные слушатели на document для закрытия меню по клику
     * вне его и по Escape. Сохраняет ссылки, чтобы потом снять.
     */
    #installGlobalCloseListeners(): void {
        this.#removeGlobalCloseListeners();
        this.#docClickHandler = (e: MouseEvent): void => {
            const menu = this.#menuEl;
            if (menu === null || menu.hidden === true) return;
            if (e.target instanceof Node && menu.contains(e.target)) return;
            this.#closeMenu();
        };
        this.#docKeyHandler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') this.#closeMenu();
        };
        document.addEventListener('click', this.#docClickHandler, { capture: true });
        document.addEventListener('contextmenu', this.#docClickHandler, { capture: true });
        document.addEventListener('keydown', this.#docKeyHandler);
    }

    /**
     * Снимает глобальные слушатели документа.
     */
    #removeGlobalCloseListeners(): void {
        if (this.#docClickHandler) {
            document.removeEventListener('click', this.#docClickHandler, { capture: true });
            document.removeEventListener('contextmenu', this.#docClickHandler, { capture: true });
            this.#docClickHandler = null;
        }
        if (this.#docKeyHandler) {
            document.removeEventListener('keydown', this.#docKeyHandler);
            this.#docKeyHandler = null;
        }
    }

    /**
     * Закрывает меню и снимает глобальные слушатели.
     */
    #closeMenu(): void {
        if (this.#menuEl !== null) {
            this.#menuEl.hidden = true;
            this.#menuEl.innerHTML = '';
        }
        this.#removeGlobalCloseListeners();
    }

    /**
     * Обрабатывает выбранный пункт меню.
     * @param file - файл, на котором было меню
     * @param action - выбранное действие
     */
    #handleMenuAction(file: FileItemDTO, action: string): void {
        switch (action) {
            case 'download':
                this.#triggerDownload(file);
                break;
            case 'share':
                this.#options.onShare?.(file);
                break;
            case 'rename':
                this.#options.onRename?.(file);
                break;
            case 'delete':
                this.#options.onDelete(file);
                break;
            default:
                break;
        }
    }

    /**
     * Программно инициирует скачивание через временный <a download>.
     * @param file - файл к скачиванию
     */
    #triggerDownload(file: FileItemDTO): void {
        const a = document.createElement('a');
        a.href = file.download_url;
        a.download = file.filename;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}
