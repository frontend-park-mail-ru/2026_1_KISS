import { NotebookHeader } from '../../widgets/notebook-header/NotebookHeader.js';
import { NotebookToolbar } from '../../widgets/notebook-toolbar/NotebookToolbar.js';
import { NotebookSidebar } from '../../widgets/notebook-sidebar/NotebookSidebar.js';
import { CellList } from '../../widgets/cell-list/CellList.js';
import { CodeCell } from '../../shared/components/code-cell/CodeCell.js';
import { TextCell } from '../../shared/components/text-cell/TextCell.js';
import type { BlockData } from '../../shared/types.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { RunnerApi } from '../../shared/api/RunnerApi.js';
import { FindEngine } from '../../shared/search/FindEngine.js';
import { Router } from '../../shared/router/Router.js';
import { ShareModal } from '../../widgets/share-modal/ShareModal.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import { NotebookWS } from '../../shared/api/NotebookWS.js';
import { nn } from '../../shared/utils/notNull.js';
import { logError } from '../../shared/utils/logger.js';
import type {
    ApiEnvelope,
    NotebookDTO,
    PermissionListResponse,
    UserDTO
} from '../../shared/api/types.js';

/**
 * Минимальный контракт ячейки для операций сохранения её содержимого.
 * Используется в обобщённых сохраняющих помощниках, чтобы не зависеть от
 * конкретного класса (CodeCell/TextCell).
 */
interface CellContentSource {
    /**
     * Возвращает текущее текстовое содержимое ячейки (исходный код или markdown).
     */
    getContent(): string;
}

/**
 * Страница редактора блокнота (`/notebooks/:id`). Главный «толстый» компонент
 * фронтенда: ответственен за загрузку notebook'а, проверку прав (owner/editor/viewer),
 * рендер всей композиции (NotebookHeader + NotebookToolbar + NotebookSidebar + CellList),
 * связь с Runner'ом по WebSocket и REST, поиск/замену по ячейкам, экспорт/импорт
 * .ipynb и live-синхронизацию изменений других пользователей через WS-события.
 *
 * Стриминг исполнения: stdout/stderr приходят чанками и аккумулируются в
 * #streamingStdout/#streamingStderr с throttle-рендером через #scheduleStreamRender,
 * чтобы не перерисовывать ячейку на каждый чанк.
 */
export class BlocksPage {
    #root: HTMLElement;
    #notebookId: string;
    #header: NotebookHeader | null = null;
    #toolbar: NotebookToolbar | null = null;
    #sidebar: NotebookSidebar | null = null;
    #cellList: CellList | null = null;
    #notebook: Record<string, unknown> | null = null;
    #userId: number | null = null;
    #username = '';
    #avatarUrl = '';
    #isAdmin = false;
    #isOwner = false;
    #canComment = false;
    #httpClient: HttpClient;
    #runnerApi: RunnerApi;

    #executionCounter = 0;
    #execNumbers = new Map<number | string, number>();
    #lastOutputs = new Map<number | string, Record<string, unknown>>();
    #beforeUnloadHandler: (() => void) | null = null;
    #feedbackModal: FeedbackModal | null = null;

    #findEngine: FindEngine = new FindEngine();

    #shareModal: ShareModal | null = null;

    #ws: NotebookWS | null = null;

    /**
     * Сохраняет root и notebookId, инициализирует HttpClient (singleton) и
     * новый экземпляр RunnerApi для запуска кода.
     * @param root - корневой элемент SPA
     * @param params - параметры маршрута (id блокнота из URL `/notebooks/:id`)
     */
    public constructor(root: HTMLElement, params: { id: string }) {
        this.#root = root;
        this.#notebookId = params.id;
        this.#httpClient = HttpClient.getInstance();
        this.#runnerApi = new RunnerApi();
    }

    /**
     * Загружает данные пользователя (`/auth/me`), затем сам блокнот,
     * вычисляет права (owner/editor/viewer через permissions endpoint) и
     * только после этого вызывает #buildLayout для рендера UI.
     * При неавторизации — редирект на /sign; при отсутствии блокнота — на /files.
     */
    public async render(): Promise<void> {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                nn(Router.getInstance()).navigate('/sign');
                return;
            }
            const body = (await response.json()) as ApiEnvelope<UserDTO>;
            const user = body.data;
            this.#userId = user.id;
            this.#username = user.username;
            this.#avatarUrl = user.avatar_url;
            this.#isAdmin = user.is_admin;
        } catch (_e) {
            nn(Router.getInstance()).navigate('/sign');
            return;
        }

        try {
            const response = await this.#httpClient.get(`/notebooks/${this.#notebookId}`);
            if (!response.ok) {
                nn(Router.getInstance()).navigate('/files');
                return;
            }
            const body = (await response.json()) as ApiEnvelope<NotebookDTO>;
            this.#notebook = body.data as unknown as Record<string, unknown>;
        } catch (_e) {
            nn(Router.getInstance()).navigate('/files');
            return;
        }

        this.#isOwner = nn(this.#notebook).owner_id === this.#userId;
        this.#canComment = this.#isOwner;
        if (!this.#canComment) {
            try {
                const permResponse = await this.#httpClient.get(
                    `/notebooks/${this.#notebookId}/permissions`
                );
                if (permResponse.ok) {
                    const body = (await permResponse.json()) as ApiEnvelope<PermissionListResponse>;
                    const perms = body.data.permissions;
                    const mine = perms.find((p) => p.user_id === this.#userId);
                    this.#canComment = mine?.permission_level === 'editor';
                }
            } catch {
                /* ignore */
            }
        }

        this.#buildLayout();
    }

    /**
     * Создаёт всю DOM-композицию страницы: NotebookHeader (с пунктами меню в
     * зависимости от прав), NotebookToolbar (Run All / добавить ячейку / комментарии),
     * NotebookSidebar (поиск/замена/история), CellList (сами ячейки).
     * Подключает обработчик beforeunload для остановки runner-сессии и
     * открывает WebSocket для real-time событий.
     */
    #buildLayout(): void {
        const page = document.createElement('div');
        page.className = 'blocks-page';

        const headerArea = document.createElement('div');
        headerArea.className = 'blocks-page__header-area';
        page.appendChild(headerArea);

        const initials = this.#username.substring(0, 2).toUpperCase();
        const isOwner = nn(this.#notebook).owner_id === this.#userId;
        this.#header = new NotebookHeader(headerArea, {
            filename: (nn(this.#notebook).title as string) || 'Untitled',
            user: { username: this.#username, initials, avatarUrl: this.#avatarUrl },
            isOwner,
            onRename: isOwner
                ? (newTitle: string): Promise<void> => this.#renameNotebook(newTitle)
                : null,
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onSave: (): Promise<void> => this.#saveAll(),
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onSaveAs: (): Promise<void> => this.#exportAsIpynb(),
            onOpen: (): void => {
                this.#importNotebook();
            },
            onProfile: (): void => {
                nn(Router.getInstance()).navigate('/profile');
            },
            onAdmin: this.#isAdmin
                ? (): void => {
                      nn(Router.getInstance()).navigate('/admin');
                  }
                : null,
            onFeedback: (): void => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onLogout: async (): Promise<void> => {
                try {
                    await this.#httpClient.post('/auth/logout');
                } catch (_e) {
                    /* ignore */
                }
                nn(Router.getInstance()).navigate('/sign');
            },
            onShare: isOwner
                ? (): void => {
                      this.#openShareModal();
                  }
                : null
        });
        this.#header.mount();

        const body = document.createElement('div');
        body.className = 'blocks-page__body';
        page.appendChild(body);

        const sidebarArea = document.createElement('div');
        sidebarArea.className = 'blocks-page__sidebar';
        body.appendChild(sidebarArea);

        const commentsVisible = localStorage.getItem('notebook_comments_visible') === 'true';
        const main = document.createElement('main');
        main.className = `blocks-page__main${commentsVisible ? ' blocks-page__main--with-comments' : ''}`;
        body.appendChild(main);

        this.#toolbar = new NotebookToolbar(headerArea, {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onAddCode: (): Promise<void> => this.#createBlock('code'),
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onAddText: (): Promise<void> => this.#createBlock('text'),
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onRunAll: (): Promise<void> => this.#runAllBlocks(),
            commentsVisible,
            onToggleComments: (visible: boolean): void => {
                this.#cellList?.toggleComments(visible);
                main.classList.toggle('blocks-page__main--with-comments', visible);
                localStorage.setItem('notebook_comments_visible', String(visible));
            }
        });
        this.#toolbar.mount();

        this.#sidebar = new NotebookSidebar(sidebarArea, {
            onFind: (q: { query: string; caseSensitive: boolean }): void => {
                this.#handleFind(q);
            },
            onNext: (q: { query: string; caseSensitive: boolean }): void => {
                this.#handleFindNav(q, 'next');
            },
            onPrev: (q: { query: string; caseSensitive: boolean }): void => {
                this.#handleFindNav(q, 'prev');
            },
            onReplace: (q: {
                query: string;
                replacement: string;
                caseSensitive: boolean;
            }): void => {
                this.#handleReplace(q);
            },
            onReplaceAll: (q: {
                query: string;
                replacement: string;
                caseSensitive: boolean;
            }): void => {
                this.#handleReplaceAll(q);
            },
            notebookId: this.#notebookId
        });
        this.#sidebar.mount();

        this.#cellList = new CellList(main, {
            notebookId: this.#notebookId,
            currentUserId: nn(this.#userId),
            isOwner: this.#isOwner,
            canComment: this.#canComment,
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onRunCell: (blockId: number | string): Promise<void> => this.#runSingleBlock(blockId),
            onRerender: (): void => {
                this.#reapplyCellState();
            },
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onDeleteCell: (blockId: number | string): Promise<void> => this.#deleteBlock(blockId),
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onSaveContent: (blockId: number | string, content: string): Promise<void> =>
                this.#saveTextCellContent(blockId, content),
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onCodeContentChange: (blockId: number | string, content: string): Promise<void> =>
                this.#saveCodeCellContent(blockId, content),
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onReorder: (blockIds: (number | string)[]): Promise<void> =>
                this.#reorderBlocks(blockIds)
        });
        this.#cellList.mount();

        this.#root.appendChild(page);

        const blocks = (nn(this.#notebook).blocks as BlockData[] | undefined) ?? [];
        this.#loadSavedOutputs(blocks as unknown as Record<string, unknown>[]);
        this.#cellList.updateBlocks(blocks);
        this.#cellList.toggleComments(commentsVisible);

        this.#beforeUnloadHandler = (): void => {
            if (this.#notebookId) this.#runnerApi.stopSessionBeacon(this.#notebookId);
        };
        window.addEventListener('beforeunload', this.#beforeUnloadHandler);

        this.#openWebSocket();
    }

    /**
     * Создаёт NotebookWS и подключается. Первый коннект пропускает re-sync
     * (данные только что загружены через REST), последующие переподключения
     * вызывают #resyncFromServer чтобы догнать пропущенные изменения.
     */
    #openWebSocket(): void {
        let skipNextResync = true;
        this.#ws = new NotebookWS(this.#notebookId, {
            onEvent: (event: Record<string, unknown>): void => {
                this.#handleWSEvent(event);
            },
            onConnect: (): void => {
                if (skipNextResync) {
                    skipNextResync = false;
                    return;
                }
                void this.#resyncFromServer();
            },
            onClose: (): void => {
                /* noop */
            }
        });
        this.#ws.connect();
    }

    #streamingResolve: (() => void) | null = null;
    #streamingBlockId: number | string | null = null;
    #streamingStdout: string[] = [];
    #streamingStderr: string[] = [];
    #streamingRenderPending = false;
    static readonly #MAX_STREAM_LINES = 1000;
    static readonly #STREAM_THROTTLE_MS = 200;

    /**
     * Главный диспетчер WebSocket-событий от Runner'а и других клиентов.
     * Обрабатывает: ошибки исполнения, добавление/обновление/удаление блоков
     * и комментариев, обновление notebook-метаданных, стрим stdout/stderr и
     * финальный execute_completed. Стрим-чанки буферизуются и рендерятся
     * через throttle (#scheduleStreamRender), чтобы избежать рендер-шторма.
     * @param event - сообщение WS с обязательным полем `type`
     */
    #handleWSEvent(event: Record<string, unknown>): void {
        if (typeof event.type !== 'string' || event.type === '') return;
        if (event.type === 'error' || event.type === 'execute_error') {
            if (this.#streamingBlockId !== null) {
                const cell = this.#cellList?.getCellByBlockId(this.#streamingBlockId);
                if (cell && cell instanceof CodeCell) {
                    cell.setOutput({
                        error: typeof event.message === 'string' ? event.message : 'execution error'
                    });
                    cell.setRunning(false);
                }
                this.#streamingBlockId = null;
                if (this.#streamingResolve) this.#streamingResolve();
            }
            return;
        }

        switch (event.type) {
            case 'block_added':
            case 'block_updated':
            case 'block_deleted':
            case 'comment_added':
            case 'comment_deleted':
                nn(this.#cellList).applyRemoteEvent(
                    event as { type: string; block?: BlockData; block_id?: string | number }
                );
                break;
            case 'notebook_updated':
                void this.#resyncFromServer();
                break;
            case 'stdout_chunk':
                if (this.#streamingBlockId !== null) {
                    this.#streamingStdout.push(
                        typeof event.message === 'string' ? event.message : ''
                    );
                    if (this.#streamingStdout.length > BlocksPage.#MAX_STREAM_LINES) {
                        this.#streamingStdout = this.#streamingStdout.slice(
                            -BlocksPage.#MAX_STREAM_LINES
                        );
                    }
                    this.#scheduleStreamRender();
                }
                break;
            case 'stderr_chunk':
                if (this.#streamingBlockId !== null) {
                    this.#streamingStderr.push(
                        typeof event.message === 'string' ? event.message : ''
                    );
                    if (this.#streamingStderr.length > BlocksPage.#MAX_STREAM_LINES) {
                        this.#streamingStderr = this.#streamingStderr.slice(
                            -BlocksPage.#MAX_STREAM_LINES
                        );
                    }
                    this.#scheduleStreamRender();
                }
                break;
            case 'execute_completed': {
                if (this.#streamingBlockId !== null) {
                    const cell = this.#cellList?.getCellByBlockId(this.#streamingBlockId);
                    const result = (event.block ?? {}) as Record<string, unknown>;
                    if (cell && cell instanceof CodeCell) {
                        this.#executionCounter += 1;
                        this.#execNumbers.set(this.#streamingBlockId, this.#executionCounter);
                        const output = {
                            stdout:
                                (result.stdout as string[] | undefined) ?? this.#streamingStdout,
                            stderr:
                                (result.stderr as string[] | undefined) ?? this.#streamingStderr,
                            result: result.result as string
                        };
                        this.#lastOutputs.set(this.#streamingBlockId, output);
                        cell.setExecutionNumber(this.#executionCounter);
                        cell.setOutput(output);
                        cell.setRunning(false);
                    }
                    this.#streamingBlockId = null;
                    if (this.#streamingResolve) this.#streamingResolve();
                }
                break;
            }
            default:
                break;
        }
    }

    /**
     * Перезагружает блокнот с сервера (no-cache) и заменяет локальное состояние,
     * если ни одна ячейка сейчас не сфокусирована — это защищает от потери
     * текущего ввода пользователя при WS-событии. Обновляет title в шапке.
     */
    async #resyncFromServer(): Promise<void> {
        if (!this.#notebookId) return;
        try {
            const response = await this.#httpClient.get(`/notebooks/${this.#notebookId}`, {
                noCache: true
            });
            if (!response.ok) return;
            const body = (await response.json()) as ApiEnvelope<NotebookDTO>;
            const notebook = body.data;
            const newTitle = notebook.title || 'Untitled';
            if (this.#notebook && newTitle !== this.#notebook.title && this.#header) {
                this.#header.setFilename(newTitle);
            }
            this.#notebook = notebook as unknown as Record<string, unknown>;
            if (!nn(this.#cellList).containsActiveElement()) {
                const blocks = (notebook.blocks ?? []) as unknown as BlockData[];
                this.#loadSavedOutputs(blocks as unknown as Record<string, unknown>[]);
                nn(this.#cellList).updateBlocks(blocks);
            }
        } catch {
            /* tolerate */
        }
    }

    /**
     * Сохраняет содержимое code-ячейки на сервер через PUT блока. Ошибки
     * молча игнорируются (auto-save не должен мешать пользователю).
     * @param blockId - идентификатор блока
     * @param content - новое содержимое (исходный код)
     */
    async #saveCodeCellContent(blockId: number | string, content: string): Promise<void> {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/blocks/${String(blockId)}`, {
                content
            });
        } catch {
            /* tolerate */
        }
    }

    /**
     * Сохраняет содержимое markdown-ячейки на сервер через PUT блока.
     * Ошибки молча игнорируются (auto-save не должен мешать пользователю).
     * @param blockId - идентификатор блока
     * @param content - новое содержимое (markdown)
     */
    async #saveTextCellContent(blockId: number | string, content: string): Promise<void> {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/blocks/${String(blockId)}`, {
                content
            });
        } catch {
            /* tolerate */
        }
    }

    /**
     * Принудительное сохранение всех ячеек: показывает индикатор в шапке и
     * параллельно сохраняет содержимое каждой ячейки. Используется кнопкой
     * "Сохранить" и перед экспортом .ipynb.
     */
    async #saveAll(): Promise<void> {
        nn(this.#header).showSaveIndicator();
        const cells = nn(this.#cellList).getAllCells();
        const promises = cells.map((cell) => this.#maybeSaveCellContent(cell.getBlockId(), cell));
        await Promise.all(promises);
    }

    /**
     * Сохраняет содержимое всех не-code (markdown) ячеек последовательно.
     * Вызывается перед добавлением нового блока, чтобы не потерять текст,
     * который пользователь только что начал писать.
     */
    async #saveAllTextCells(): Promise<void> {
        const allCells = nn(this.#cellList).getAllCells();
        for (const cell of allCells) {
            if (!(cell instanceof CodeCell)) {
                await this.#maybeSaveCellContent(cell.getBlockId(), cell);
            }
        }
    }

    /**
     * Создаёт новый блок указанного типа в конце notebook'а: предварительно
     * сохраняет все text-ячейки, отправляет POST на создание (с language=python
     * для code), затем перезагружает блокнот целиком чтобы получить актуальный
     * список с новым блоком на корректной позиции.
     * @param type - 'code' или 'text'
     */
    async #createBlock(type: string): Promise<void> {
        await this.#saveAllTextCells();
        try {
            const body: Record<string, string> = { type, content: '' };
            if (type === 'code') {
                body.language = 'python';
            }
            const response = await this.#httpClient.post(
                `/notebooks/${this.#notebookId}/blocks`,
                body
            );
            if (!response.ok) return;

            const reloadResponse = await this.#httpClient.get(`/notebooks/${this.#notebookId}`, {
                noCache: true
            });
            if (!reloadResponse.ok) return;
            const reloaded = (await reloadResponse.json()) as ApiEnvelope<NotebookDTO>;
            this.#notebook = reloaded.data as unknown as Record<string, unknown>;
            nn(this.#cellList).updateBlocks((reloaded.data.blocks ?? []) as unknown as BlockData[]);
        } catch (e: unknown) {
            logError('Failed to create block:', e);
        }
    }

    /**
     * Удаляет блок через DELETE и перезагружает notebook. Удаляет также
     * сохранённые execution-номер и output для этого блока, чтобы не утекать
     * память и не путать пользователя при создании нового блока с тем же id.
     * @param blockId - идентификатор удаляемого блока
     */
    async #deleteBlock(blockId: number | string): Promise<void> {
        try {
            const response = await this.#httpClient.delete(
                `/notebooks/${this.#notebookId}/blocks/${String(blockId)}`
            );
            if (!response.ok) return;

            const reloadResponse = await this.#httpClient.get(`/notebooks/${this.#notebookId}`, {
                noCache: true
            });
            if (!reloadResponse.ok) return;
            const reloaded = (await reloadResponse.json()) as ApiEnvelope<NotebookDTO>;
            this.#notebook = reloaded.data as unknown as Record<string, unknown>;
            nn(this.#cellList).updateBlocks((reloaded.data.blocks ?? []) as unknown as BlockData[]);
            this.#execNumbers.delete(blockId);
            this.#lastOutputs.delete(blockId);
        } catch (e: unknown) {
            logError('Failed to delete block:', e);
        }
    }

    /**
     * Throttle-обёртка для рендера стримящихся stdout/stderr: запоминает что
     * рендер запланирован, и через #STREAM_THROTTLE_MS показывает накопленные
     * чанки в активной ячейке. Защищает от рендер-шторма при быстром потоке
     * вывода (например `for i in range(10000): print(i)`).
     */
    #scheduleStreamRender(): void {
        if (this.#streamingRenderPending) return;
        this.#streamingRenderPending = true;
        setTimeout(() => {
            this.#streamingRenderPending = false;
            if (this.#streamingBlockId === null) return;
            const cell = this.#cellList?.getCellByBlockId(this.#streamingBlockId);
            if (cell && cell instanceof CodeCell) {
                cell.setOutput({
                    stdout: this.#streamingStdout,
                    stderr: this.#streamingStderr
                });
            }
        }, BlocksPage.#STREAM_THROTTLE_MS);
    }

    /**
     * Запускает одну code-ячейку. Если WS открыт — стримит stdout/stderr
     * чанками через WS и ждёт execute_completed. Иначе fallback на REST
     * /runner/execute. В любом случае предварительно сохраняет содержимое
     * ячейки и обновляет execution-counter + output после завершения.
     * @param blockId - идентификатор запускаемого блока
     */
    async #runSingleBlock(blockId: number | string): Promise<void> {
        const cell = nn(this.#cellList).getCellByBlockId(blockId);
        if (!cell || !(cell instanceof CodeCell)) return;
        const position = nn(this.#cellList).getBlockPositionById(blockId);
        if (position < 0) return;

        await this.#maybeSaveCellContent(blockId, cell);

        cell.setRunning(true);

        if (this.#ws && this.#ws.isOpen()) {
            this.#streamingBlockId = blockId;
            this.#streamingStdout = [];
            this.#streamingStderr = [];
            cell.setOutput({});
            this.#ws.executeBlock(position);
            await new Promise<void>((resolve) => {
                this.#streamingResolve = resolve;
            });
        } else {
            try {
                const result = await this.#runnerApi.executeBlock(this.#notebookId, position);
                this.#executionCounter += 1;
                this.#execNumbers.set(blockId, this.#executionCounter);
                this.#lastOutputs.set(blockId, {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    result: result.result,
                    outputs: result.outputs
                });
                cell.setExecutionNumber(this.#executionCounter);
                cell.setOutput(this.#lastOutputs.get(blockId));
            } catch (e: unknown) {
                const errOut = { error: (e as Error).message || String(e) };
                this.#lastOutputs.set(blockId, errOut);
                cell.setOutput(errOut);
            } finally {
                cell.setRunning(false);
            }
        }
    }

    /**
     * Запускает все code-ячейки последовательно через REST executeFromPosition.
     * Сначала сохраняет содержимое всех code-ячеек, затем переводит каждую в
     * состояние running, далее посылает один батч-запрос и распределяет
     * результаты по ячейкам по block_id. При общей ошибке восстанавливает
     * предыдущие outputs (savedOutputs) для ячеек, которые не успели выполниться.
     */
    async #runAllBlocks(): Promise<void> {
        const codeCells = nn(this.#cellList).getCodeCellsInOrder();
        if (codeCells.length === 0) return;

        for (const c of codeCells) {
            await this.#maybeSaveCellContent(c.getBlockId(), c);
        }

        const savedOutputs = new Map<number | string, Record<string, unknown>>();
        codeCells.forEach((c) => {
            const blockId = c.getBlockId();
            if (this.#lastOutputs.has(blockId)) {
                savedOutputs.set(blockId, nn(this.#lastOutputs.get(blockId)));
            }
        });

        codeCells.forEach((c) => {
            c.setRunning(true);
        });

        try {
            const results = await this.#runnerApi.executeFromPosition(this.#notebookId, 0);
            if (!Array.isArray(results)) return;

            const resultMap = new Map<number | string, Record<string, unknown>>();
            results.forEach((r) => {
                resultMap.set(r.block_id, r as unknown as Record<string, unknown>);
            });

            codeCells.forEach((c) => {
                const blockId = c.getBlockId();
                const r = resultMap.get(blockId);

                if (!r) {
                    if (savedOutputs.has(blockId)) {
                        c.setOutput(savedOutputs.get(blockId));
                    }
                    return;
                }

                if (r.error !== undefined && r.error !== null) {
                    const errOut = { error: r.error } as Record<string, unknown>;
                    this.#lastOutputs.set(blockId, errOut);
                    c.setOutput(errOut);
                    return;
                }

                this.#executionCounter += 1;
                this.#execNumbers.set(blockId, this.#executionCounter);
                const out = {
                    stdout: r.stdout,
                    stderr: r.stderr,
                    result: r.result,
                    outputs: r.outputs
                } as Record<string, unknown>;
                this.#lastOutputs.set(blockId, out);
                c.setExecutionNumber(this.#executionCounter);
                c.setOutput(out);
            });
        } catch (e: unknown) {
            const errOut = { error: `Run-all failed: ${String((e as Error).message || e)}` };
            codeCells.forEach((c) => {
                const blockId = c.getBlockId();
                if (savedOutputs.has(blockId)) {
                    c.setOutput(savedOutputs.get(blockId));
                } else {
                    this.#lastOutputs.set(blockId, errOut);
                    c.setOutput(errOut);
                }
            });
        } finally {
            codeCells.forEach((c) => {
                c.setRunning(false);
            });
        }
    }

    /**
     * Восстанавливает execution-номера и outputs во всех code-ячейках из
     * локальных Map'ов. Вызывается после rerender'а CellList'а (например,
     * после WS-события block_added/block_updated), когда DOM пересоздан.
     */
    #reapplyCellState(): void {
        this.#execNumbers.forEach((n, id) => {
            const cell = nn(this.#cellList).getCellByBlockId(id);
            if (cell && cell instanceof CodeCell) cell.setExecutionNumber(n);
        });
        this.#lastOutputs.forEach((out, id) => {
            const cell = nn(this.#cellList).getCellByBlockId(id);
            if (cell && cell instanceof CodeCell) cell.setOutput(out);
        });
    }

    /**
     * Сохраняет текущее содержимое произвольной ячейки (по контракту
     * CellContentSource) через PUT блока. Ошибки молча игнорируются.
     * @param blockId - идентификатор блока
     * @param cell - источник содержимого с методом getContent()
     */
    async #maybeSaveCellContent(
        blockId: number | string,
        cell: CellContentSource
    ): Promise<void> {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/blocks/${String(blockId)}`, {
                content: cell.getContent()
            });
        } catch {
            /* tolerate */
        }
    }

    /**
     * Восстанавливает outputs из ответа GET /notebooks/:id (блоки приходят с
     * сохранёнными результатами последнего исполнения) в локальный Map
     * #lastOutputs. Преобразует формат хранения (output_type/content) в
     * формат для UI (stdout/stderr/result/outputs[mime_type/data]).
     * Если для блока уже есть локальные outputs (свежее) — пропускает.
     * @param blocks - массив блоков из ответа сервера
     */
    #loadSavedOutputs(blocks: Record<string, unknown>[]): void {
        for (const block of blocks) {
            const outputs = block.outputs as Record<string, unknown>[] | undefined;
            if (!outputs || outputs.length === 0) continue;
            if (this.#lastOutputs.has(block.id as number | string)) continue;
            const out: Record<string, unknown> = {};
            for (const o of outputs) {
                if (o.output_type === 'stdout') out.stdout = [o.content];
                else if (o.output_type === 'stderr') out.stderr = [o.content];
                else if (o.output_type === 'result') out.result = o.content;
                else {
                    out.outputs ??= [];
                    (out.outputs as Record<string, unknown>[]).push({
                        mime_type: o.output_type,
                        data: o.content
                    });
                }
            }
            this.#lastOutputs.set(block.id as number | string, out);
        }
    }

    /**
     * Экспортирует текущий блокнот в формат Jupyter `.ipynb`. Сначала
     * сохраняет все ячейки, затем строит nbformat-4 структуру:
     * - text-ячейки → cell_type=markdown
     * - code-ячейки → cell_type=code с outputs из #lastOutputs
     *   (stdout/stderr → stream, result → execute_result, остальное → display_data)
     * Скачивает результат через временный <a> элемент с blob: URL.
     */
    async #exportAsIpynb(): Promise<void> {
        await this.#saveAll();
        const cells = nn(this.#cellList).getAllCells();
        const ipynbCells = cells.map((cell) => {
            const blockId = cell.getBlockId();
            const content = cell.getContent();
            const isCode = cell instanceof CodeCell;
            const source = content
                ? content
                      .split('\n')
                      .map((l: string, i: number, a: string[]) => (i < a.length - 1 ? `${l}\n` : l))
                : [];

            if (!isCode) {
                return { cell_type: 'markdown', metadata: {}, source };
            }

            const out = this.#lastOutputs.get(blockId);
            const outputs: Record<string, unknown>[] = [];
            if (out) {
                if ((out.stdout as string[]).length) {
                    outputs.push({
                        output_type: 'stream',
                        name: 'stdout',
                        text: (out.stdout as string[]).map((s: string) => `${s}\n`)
                    });
                }
                if ((out.stderr as string[]).length) {
                    outputs.push({
                        output_type: 'stream',
                        name: 'stderr',
                        text: (out.stderr as string[]).map((s: string) => `${s}\n`)
                    });
                }
                if (out.result !== undefined && out.result !== null) {
                    outputs.push({
                        output_type: 'execute_result',
                        execution_count: null,
                        data: { 'text/plain': [out.result] },
                        metadata: {}
                    });
                }
                if (out.outputs !== undefined && out.outputs !== null) {
                    for (const o of out.outputs as { mime_type: string; data: string }[]) {
                        outputs.push({
                            output_type: 'display_data',
                            data: { [o.mime_type]: o.data },
                            metadata: {}
                        });
                    }
                }
            }
            return {
                cell_type: 'code',
                execution_count: null,
                metadata: {},
                source,
                outputs
            };
        });

        const ipynb = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {
                kernelspec: {
                    display_name: 'Python 3',
                    language: 'python',
                    name: 'python3'
                },
                language_info: { name: 'python', version: '3.13' }
            },
            cells: ipynbCells
        };

        const blob = new Blob([JSON.stringify(ipynb, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(this.#notebook?.title as string) || 'Untitled'}.ipynb`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Импортирует .ipynb-файл: открывает file picker, парсит JSON nbformat,
     * преобразует cells (markdown/code) в наш формат блоков (с position и
     * вложенными outputs из stream/execute_result/display_data/error),
     * отправляет POST /notebooks/import и навигирует на новый блокнот.
     * Title берётся из имени файла без расширения (или 'Imported').
     */
    #importNotebook(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ipynb';
        input.onchange = async (e: Event): Promise<void> => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const ipynb = JSON.parse(text) as { cells?: Record<string, unknown>[] };

                const blocks = (ipynb.cells ?? []).map((cell, i) => {
                    const content = Array.isArray(cell.source)
                        ? (cell.source as string[]).join('')
                        : (cell.source as string) || '';
                    const type = cell.cell_type === 'code' ? 'code' : 'text';
                    const language = type === 'code' ? 'python' : 'markdown';
                    const outputs: Record<string, unknown>[] = [];

                    if (type === 'code' && Boolean(cell.outputs)) {
                        let pos = 0;
                        for (const o of cell.outputs as Record<string, unknown>[]) {
                            if (o.output_type === 'stream') {
                                const t = Array.isArray(o.text)
                                    ? (o.text as string[]).join('')
                                    : (o.text as string) || '';
                                outputs.push({
                                    output_type: o.name ?? 'stdout',
                                    content: t,
                                    position: pos++
                                });
                            } else if (
                                o.output_type === 'execute_result' ||
                                o.output_type === 'display_data'
                            ) {
                                if (o.data !== undefined && o.data !== null) {
                                    for (const [mime, val] of Object.entries(
                                        o.data as Record<string, unknown>
                                    )) {
                                        const c = Array.isArray(val)
                                            ? (val as string[]).join('')
                                            : String(val);
                                        outputs.push({
                                            output_type: mime === 'text/plain' ? 'result' : mime,
                                            content: c,
                                            position: pos++
                                        });
                                    }
                                }
                            } else if (o.output_type === 'error') {
                                const tb = ((o.traceback ?? []) as string[]).join('\n');
                                outputs.push({
                                    output_type: 'stderr',
                                    content: tb,
                                    position: pos++
                                });
                            }
                        }
                    }
                    return { type, language, content, position: i, outputs };
                });

                const title = file.name.replace(/\.ipynb$/, '') || 'Imported';
                const resp = await this.#httpClient.post('/notebooks/import', { title, blocks });
                if (resp.ok) {
                    const { data: notebook } = (await resp.json()) as {
                        data: Record<string, unknown>;
                    };
                    nn(Router.getInstance()).navigate(`/notebooks/${String(notebook.id)}`);
                }
            } catch (err: unknown) {
                logError('Failed to import notebook:', err);
            }
        };
        input.click();
    }

    /**
     * Меняет порядок блоков на сервере (drag-n-drop в CellList).
     * Серверный endpoint /reorder обновляет position у каждого блока
     * по присланному массиву id. Ошибки молча игнорируются.
     * @param blockIds - новый порядок идентификаторов блоков
     */
    async #reorderBlocks(blockIds: (number | string)[]): Promise<void> {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/reorder`, {
                block_ids: blockIds
            });
        } catch {
            /* tolerate */
        }
    }

    /**
     * Открывает ShareModal для управления доступом к блокноту (только для
     * владельца). Lazy-создаёт инстанс модалки при первом вызове.
     */
    #openShareModal(): void {
        if (!this.#shareModal) {
            this.#shareModal = new ShareModal();
        }
        void this.#shareModal.open(
            this.#notebookId,
            (this.#notebook?.title as string) || 'Untitled',
            (this.#notebook?.is_public as boolean | undefined) ?? false
        );
    }

    /**
     * Переименовывает блокнот через PUT /notebooks/:id и обновляет
     * локальное состояние из ответа (мерж в #notebook). Ошибки логируются.
     * @param newTitle - новое название блокнота
     */
    async #renameNotebook(newTitle: string): Promise<void> {
        try {
            const response = await this.#httpClient.put(`/notebooks/${this.#notebookId}`, {
                title: newTitle
            });
            if (response.ok) {
                const body = (await response.json()) as ApiEnvelope<NotebookDTO>;
                Object.assign(nn(this.#notebook), body.data);
            }
        } catch (e: unknown) {
            logError('Failed to rename notebook:', e);
        }
    }

    /**
     * Собирает плоский снимок всех ячеек для FindEngine: id, тип
     * (code/text) и текущее содержимое. Вызывается на каждый поиск, чтобы
     * учитывать несохранённые изменения.
     * @returns массив снимков ячеек для поиска
     */
    #collectSearchableCells(): { id: number | string; kind: 'code' | 'text'; content: string }[] {
        return nn(this.#cellList)
            .getAllCells()
            .map((c) => ({
                id: c.getBlockId(),
                kind: c instanceof CodeCell ? 'code' : 'text',
                content: c.getContent()
            }));
    }

    /**
     * Запускает новый поиск через FindEngine: собирает текущие ячейки,
     * передаёт в движок, обновляет счётчик в sidebar и сразу фокусирует
     * первое совпадение.
     * @param param0 - параметры поиска: строка query и флаг caseSensitive
     */
    #handleFind({ query, caseSensitive }: { query: string; caseSensitive: boolean }): void {
        const cells = this.#collectSearchableCells();
        const total = this.#findEngine.search(cells, query, caseSensitive);
        nn(this.#sidebar).setMatchCount(this.#findEngine.index(), total);
        if (total > 0) this.#focusCurrentMatch();
    }

    /**
     * Навигация по результатам поиска (стрелки next/prev в sidebar).
     * Если движок ещё не искал (total=0) — сначала запускает поиск.
     * @param query - параметры текущего поиска
     * @param direction - 'next' (вперёд) или 'prev' (назад)
     */
    #handleFindNav(
        query: { query: string; caseSensitive: boolean },
        direction: 'next' | 'prev'
    ): void {
        if (this.#findEngine.total() === 0) {
            this.#handleFind(query);
            return;
        }
        const m = direction === 'next' ? this.#findEngine.next() : this.#findEngine.prev();
        if (m) {
            nn(this.#sidebar).setMatchCount(this.#findEngine.index(), this.#findEngine.total());
            this.#focusCurrentMatch();
        }
    }

    /**
     * Подсвечивает текущее совпадение поиска: сначала снимает все подсветки
     * с TextCell'ов, затем подсвечивает диапазон в нужной ячейке (highlightRange
     * для CodeCell, highlightMatch для TextCell с учётом порядкового индекса).
     */
    #focusCurrentMatch(): void {
        nn(this.#cellList)
            .getAllCells()
            .filter((c): c is TextCell => c instanceof TextCell)
            .forEach((c) => {
                c.clearHighlights();
            });

        const m = this.#findEngine.current();
        if (!m) return;
        const cell = nn(this.#cellList).getCellByBlockId(m.blockId);
        if (!cell) return;

        if (m.kind === 'code' && cell instanceof CodeCell) {
            cell.highlightRange(m.start, m.end);
        } else if (m.kind === 'text' && cell instanceof TextCell) {
            cell.highlightMatch(m.index, m.start, m.end);
        }
    }

    /**
     * Заменяет текущее совпадение на replacement и переходит к следующему.
     * Если поиск ещё не активен — запускает его. Использует substring/concat
     * по индексам [start, end] из FindEngine.
     * @param param0 - параметры замены: query, replacement, caseSensitive
     */
    #handleReplace({
        query,
        replacement,
        caseSensitive
    }: {
        query: string;
        replacement: string;
        caseSensitive: boolean;
    }): void {
        if (this.#findEngine.total() === 0) {
            this.#handleFind({ query, caseSensitive });
            if (this.#findEngine.total() === 0) return;
        }
        const m = this.#findEngine.current();
        if (!m) return;
        const cell = nn(this.#cellList).getCellByBlockId(m.blockId);
        if (!cell || typeof cell.setContent !== 'function') return;

        const content = cell.getContent();
        const updated = content.substring(0, m.start) + replacement + content.substring(m.end);
        cell.setContent(updated);

        this.#handleFind({ query, caseSensitive });
    }

    /**
     * Заменяет все вхождения query на replacement во всех ячейках одним
     * RegExp.replace (с эскейпом метасимволов и флагом g/gi). Сбрасывает
     * FindEngine — счётчик в sidebar показывает 0 после операции.
     * @param param0 - параметры массовой замены: query, replacement, caseSensitive
     */
    #handleReplaceAll({
        query,
        replacement,
        caseSensitive
    }: {
        query: string;
        replacement: string;
        caseSensitive: boolean;
    }): void {
        if (!query) return;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
        for (const cell of nn(this.#cellList).getAllCells()) {
            const original = cell.getContent();
            const updated = original.replace(re, replacement);
            if (updated !== original) cell.setContent(updated);
        }
        this.#findEngine.reset();
        nn(this.#sidebar).setMatchCount(-1, 0);
    }

    /**
     * Полная очистка страницы: останавливает runner-сессию, снимает
     * beforeunload-обработчик, закрывает WebSocket и ShareModal,
     * размонтирует все виджеты (CellList → Sidebar → Toolbar → Header)
     * и очищает root. Вызывается роутером при переходе на другую страницу.
     */
    public destroy(): void {
        if (this.#notebookId) {
            void this.#runnerApi.stopSession(this.#notebookId);
        }
        if (this.#beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.#beforeUnloadHandler);
            this.#beforeUnloadHandler = null;
        }
        if (this.#ws) {
            this.#ws.close();
            this.#ws = null;
        }
        if (this.#shareModal) this.#shareModal.close();
        if (this.#cellList) this.#cellList.unmount();
        if (this.#sidebar) this.#sidebar.unmount();
        if (this.#toolbar) this.#toolbar.unmount();
        if (this.#header) this.#header.unmount();
        this.#root.innerHTML = '';
    }
}
