import { nn } from '../../shared/utils/notNull.js';
import { formatBytes } from '../../shared/utils/formatBytes.js';
import { logError } from '../../shared/utils/logger.js';
import { SharedFileCard, SharedFilePageTemplate } from './SharedFilePage.template.js';

/**
 * Публичная страница `/shared/files/:token`: метаданные файла + кнопка
 * «Скачать». Доступна без авторизации. Метаданные берутся из заголовков
 * HEAD-запроса к `/api/v1/shared/files/:token` (бэк возвращает Content-
 * Disposition с filename, Content-Length и Content-Type). По клику на
 * «Скачать» происходит обычный GET того же endpoint'а, который инкрементит
 * счётчик скачиваний.
 */
export class SharedFilePage {
    #root: HTMLElement;

    /**
     * Сохраняет корневой элемент SPA для последующего рендеринга страницы.
     * @param root - корневой DOM-узел
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
    }

    /**
     * Рендерит страницу: вычисляет токен из URL, делает HEAD, заполняет
     * карточку или показывает ошибку.
     * @param params - параметры маршрута (ожидается :token)
     */
    public async render(params?: Record<string, string>): Promise<void> {
        this.#root.innerHTML = SharedFilePageTemplate();
        const token = params?.token ?? this.#extractTokenFromPath();
        if (!token) {
            this.#showError('Ссылка некорректна');
            return;
        }
        await this.#fetchAndRender(token);
    }

    /**
     * Размонтирует страницу со страницы (вызывается роутером при смене маршрута).
     */
    public destroy(): void {
        this.#root.innerHTML = '';
    }

    /**
     * Берёт токен из текущего pathname вида /shared/files/<token>.
     * @returns токен или пустую строку
     */
    #extractTokenFromPath(): string {
        const parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] ?? '';
    }

    /**
     * HEAD на download endpoint. Если 410 — ссылка истекла, 404 — не найдено.
     * На успехе достаёт имя/размер/MIME из заголовков и строит карточку.
     * @param token - share-токен из URL
     */
    async #fetchAndRender(token: string): Promise<void> {
        const url = `/api/v1/shared/files/${encodeURIComponent(token)}`;
        try {
            const head = await fetch(url, { method: 'HEAD' });
            if (head.status === 410) {
                this.#showError('Срок действия ссылки истёк');
                return;
            }
            if (head.status === 404) {
                this.#showError('Файл не найден');
                return;
            }
            if (!head.ok) {
                this.#showError('Не удалось загрузить файл');
                return;
            }
            const filename = this.#extractFilename(head.headers.get('content-disposition'));
            const sizeStr = formatBytes(Number(head.headers.get('content-length') ?? 0));
            const mime = head.headers.get('content-type') ?? 'application/octet-stream';
            this.#renderCard(filename, sizeStr, mime, url);
        } catch (error) {
            logError('SharedFilePage.fetch failed', error);
            this.#showError('Сервер недоступен');
        }
    }

    /**
     * Достаёт имя файла из заголовка Content-Disposition.
     * @param header - значение заголовка или null
     * @returns имя файла либо «Файл»
     */
    #extractFilename(header: string | null): string {
        if (header === null || header === '') return 'Файл';
        const m = /filename\*?="?([^";]+)"?/u.exec(header);
        if (m?.[1] === undefined) return 'Файл';
        return m[1].trim();
    }

    /**
     * Подменяет содержимое карточки на успешный шаблон.
     * @param filename - имя файла
     * @param size - размер (отформатированный)
     * @param mime - MIME
     * @param href - download URL
     */
    #renderCard(filename: string, size: string, mime: string, href: string): void {
        const content = nn(this.#root.querySelector<HTMLElement>('.shared-file-page__content'));
        content.innerHTML = SharedFileCard(filename, size, mime, href);
    }

    /**
     * Подменяет содержимое карточки на сообщение об ошибке.
     * @param message - текст для отображения
     */
    #showError(message: string): void {
        const content = nn(this.#root.querySelector<HTMLElement>('.shared-file-page__content'));
        content.innerHTML = `<p class="shared-file-page__error">${this.#escape(message)}</p>`;
    }

    /**
     * Экранирует HTML-спецсимволы для безопасной вставки.
     * @param str - исходная строка
     * @returns строка без HTML-инъекций
     */
    #escape(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
