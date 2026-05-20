/* eslint-disable max-lines -- TODO(refactor): extract BlockExecutor (#runSingleBlock + #runAllBlocks) into shared/domain/notebook/, ~120 строк уйдёт; уже срезано 35% от исходных 1179 */
import { NotebookHeader } from '../../widgets/notebook-header/NotebookHeader.js';
import { NotebookToolbar } from '../../widgets/notebook-toolbar/NotebookToolbar.js';
import {
    NotebookSidebar,
    type NotebookSearchAdapter,
    type SearchMatch,
    type SearchableCellSnapshot
} from '../../widgets/notebook-sidebar/NotebookSidebar.js';
import { CellList } from '../../widgets/cell-list/CellList.js';
import { CodeCell } from '../../shared/components/code-cell/CodeCell.js';
import { TextCell } from '../../shared/components/text-cell/TextCell.js';
import type { BlockData } from '../../shared/types.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { NotebookApi } from '../../shared/api/NotebookApi.js';
import { NotebookModel } from '../../shared/domain/notebook/NotebookModel.js';
import { NotebookPermissions } from '../../shared/domain/permissions/NotebookPermissions.js';
import {
    cellsToIpynb,
    ipynbToBlocks,
    type CellOutput,
    type ExportCell
} from '../../shared/domain/notebook/nbformat.js';
import {
    ExecutionState,
    runnerResultToCellOutput
} from '../../shared/domain/notebook/ExecutionState.js';
import { StreamBuffer } from '../../shared/domain/streaming/StreamBuffer.js';
import { createWsHandler } from './BlocksPage.events.js';
import { RunnerApi } from '../../shared/api/RunnerApi.js';
import { Router } from '../../shared/router/Router.js';
import { ShareModal } from '../../widgets/share-modal/ShareModal.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import { NotebookWS } from '../../shared/api/NotebookWS.js';
import { StatsWS } from '../../shared/api/StatsWS.js';
import { nn } from '../../shared/utils/notNull.js';
import { logError } from '../../shared/utils/logger.js';
import { isAuthError } from '../../shared/http_client/authStatus.js';
import { renderServerUnavailable } from '../../shared/utils/serverUnavailable.js';
import type {
    ApiEnvelope,
    ContainerStatsDTO,
    PermissionDTO,
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
 * StreamBuffer (#streamBuffer) с throttle-flush'ем, чтобы не перерисовывать
 * ячейку на каждый чанк.
 */
export class BlocksPage {
    #root: HTMLElement;
    #notebookId: string;
    #header: NotebookHeader | null = null;
    #toolbar: NotebookToolbar | null = null;
    #sidebar: NotebookSidebar | null = null;
    #cellList: CellList | null = null;
    #model: NotebookModel | null = null;
    #userId: number | null = null;
    #username = '';
    #avatarUrl = '';
    #isAdmin = false;
    #perms: NotebookPermissions | null = null;
    #httpClient: HttpClient;
    #notebookApi: NotebookApi;
    #runnerApi: RunnerApi;

    #execState = new ExecutionState();
    #beforeUnloadHandler: (() => void) | null = null;
    #feedbackModal: FeedbackModal | null = null;

    #shareModal: ShareModal | null = null;

    #ws: NotebookWS | null = null;
    #statsWs: StatsWS | null = null;

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
        this.#notebookApi = new NotebookApi();
        this.#runnerApi = new RunnerApi();
        this.#streamBuffer = new StreamBuffer({
            onFlush: (blockId, stdout, stderr): void => {
                const cell = this.#cellList?.getCellByBlockId(blockId);
                if (cell instanceof CodeCell) {
                    cell.setOutput({ stdout, stderr });
                }
            }
        });
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
            if (isAuthError(response.status)) {
                nn(Router.getInstance()).navigate('/sign');
                return;
            }
            if (!response.ok) {
                renderServerUnavailable(this.#root);
                return;
            }
            const body = (await response.json()) as ApiEnvelope<UserDTO>;
            const user = body.data;
            this.#userId = user.id;
            this.#username = user.username;
            this.#avatarUrl = user.avatar_url;
            this.#isAdmin = user.is_admin;
        } catch (_e) {
            renderServerUnavailable(this.#root);
            return;
        }

        try {
            const notebook = await this.#notebookApi.getNotebook(this.#notebookId);
            this.#model = new NotebookModel(notebook);
        } catch (_e) {
            nn(Router.getInstance()).navigate('/files');
            return;
        }

        if (nn(this.#model).isOwner(this.#userId)) {
            this.#perms = NotebookPermissions.forOwner();
        } else {
            let permissions: PermissionDTO[] = [];
            try {
                permissions = (await this.#notebookApi.getPermissions(this.#notebookId))
                    .permissions;
            } catch {
                /* ignore */
            }
            this.#perms = NotebookPermissions.forSharedUser(permissions, this.#userId);
        }

        this.#buildLayout();
    }

    /**
     * Создаёт NotebookHeader с пунктами меню (зависят от прав) и монтирует
     * его в headerArea. Извлечено из #buildLayout, чтобы тот укладывался
     * в лимиты по длине метода.
     * @param headerArea - контейнер для шапки
     */
    #buildHeader(headerArea: HTMLElement): void {
        const initials = this.#username.substring(0, 2).toUpperCase();
        const model = nn(this.#model);
        const isOwner = model.isOwner(this.#userId);
        this.#header = new NotebookHeader(headerArea, {
            filename: model.title || 'Untitled',
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
                    const response = await this.#httpClient.post('/auth/logout');
                    if (response.ok || isAuthError(response.status)) {
                        nn(Router.getInstance()).navigate('/sign');
                        return;
                    }
                    logError('Logout failed with HTTP status', response.status);
                } catch (e: unknown) {
                    logError('Logout request failed', e);
                }
            },
            onShare: isOwner
                ? (): void => {
                      this.#openShareModal();
                  }
                : null
        });
        this.#header.mount();
    }

    /**
     * Создаёт всю DOM-композицию страницы: NotebookHeader (через #buildHeader),
     * NotebookToolbar, NotebookSidebar, CellList. Подключает beforeunload и
     * открывает WebSocket.
     */
    #buildLayout(): void {
        const page = document.createElement('div');
        page.className = 'blocks-page';

        const headerArea = document.createElement('div');
        headerArea.className = 'blocks-page__header-area';
        page.appendChild(headerArea);

        this.#buildHeader(headerArea);

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
            searchTarget: this.#buildSearchAdapter(),
            notebookId: this.#notebookId
        });
        this.#sidebar.mount();

        const cellList = this.#buildCellList(main);

        this.#root.appendChild(page);

        const blocks = nn(this.#model).blocks as unknown as BlockData[];
        this.#execState.loadFromServerBlocks(blocks as unknown as Record<string, unknown>[]);
        cellList.updateBlocks(blocks);
        cellList.toggleComments(commentsVisible);

        this.#beforeUnloadHandler = (): void => {
            if (this.#notebookId) this.#runnerApi.stopSessionBeacon(this.#notebookId);
        };
        window.addEventListener('beforeunload', this.#beforeUnloadHandler);

        this.#openWebSocket();
        this.#openStatsWS();
    }

    /**
     * Создаёт NotebookWS и подключается. Первый коннект пропускает re-sync
     * (данные только что загружены через REST), последующие переподключения
     * вызывают #resyncFromServer чтобы догнать пропущенные изменения.
     */
    #openWebSocket(): void {
        let skipNextResync = true;
        const wsHandler = createWsHandler({
            streamBuffer: this.#streamBuffer,
            execState: this.#execState,
            getCellList: (): CellList | null => this.#cellList,
            onStreamComplete: (): void => {
                if (this.#streamingResolve) this.#streamingResolve();
            },
            onResync: (): void => {
                void this.#resyncFromServer();
            }
        });
        this.#ws = new NotebookWS(this.#notebookId, {
            onEvent: wsHandler,
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

    /**
     * Создаёт CellList с полным набором callback'ов (run/reorder/delete/save),
     * сохраняет его в this.#cellList и монтирует. Возвращает созданный
     * инстанс, чтобы caller мог сразу его использовать без повторных null-проверок
     * на поле. Вынесено из #buildLayout, чтобы тот не превышал лимит по
     * числу statement'ов.
     * @param main - DOM-контейнер для списка ячеек
     * @returns созданный и смонтированный CellList
     */
    #buildCellList(main: HTMLElement): CellList {
        const cellList = new CellList(main, {
            notebookId: this.#notebookId,
            currentUserId: nn(this.#userId),
            isOwner: nn(this.#perms).isOwner,
            canComment: nn(this.#perms).canComment,
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
        this.#cellList = cellList;
        cellList.mount();
        return cellList;
    }

    /**
     * Открывает stats-WebSocket для получения ресурсной статистики runner-контейнера
     * (CPU/memory/queue-position). Полученные значения отдаются в NotebookToolbar
     * для отображения session-state.
     */
    #openStatsWS(): void {
        this.#statsWs = new StatsWS(this.#notebookId, (stats: ContainerStatsDTO) => {
            this.#toolbar?.setSessionState(stats.session_state, stats.queue_position);
        });
        this.#statsWs.connect();
    }

    #streamingResolve: (() => void) | null = null;
    #streamBuffer: StreamBuffer;

    /**
     * Перезагружает блокнот с сервера (no-cache) и заменяет локальное состояние,
     * если ни одна ячейка сейчас не сфокусирована — это защищает от потери
     * текущего ввода пользователя при WS-событии. Обновляет title в шапке.
     */
    async #resyncFromServer(): Promise<void> {
        if (!this.#notebookId) return;
        try {
            const notebook = await this.#notebookApi.getNotebook(this.#notebookId, {
                noCache: true
            });
            const newTitle = notebook.title || 'Untitled';
            if (this.#model && newTitle !== this.#model.title && this.#header) {
                this.#header.setFilename(newTitle);
            }
            nn(this.#model).replaceFrom(notebook);
            if (!nn(this.#cellList).containsActiveElement()) {
                const blocks = (notebook.blocks ?? []) as unknown as BlockData[];
                this.#execState.loadFromServerBlocks(
                    blocks as unknown as Record<string, unknown>[]
                );
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
            await this.#notebookApi.updateBlockContent(this.#notebookId, blockId, content);
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
            await this.#notebookApi.updateBlockContent(this.#notebookId, blockId, content);
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
            await this.#notebookApi.createBlock(this.#notebookId, type);
            const reloaded = await this.#notebookApi.getNotebook(this.#notebookId, {
                noCache: true
            });
            nn(this.#model).replaceFrom(reloaded);
            nn(this.#cellList).updateBlocks((reloaded.blocks ?? []) as unknown as BlockData[]);
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
            await this.#notebookApi.deleteBlock(this.#notebookId, blockId);
            const reloaded = await this.#notebookApi.getNotebook(this.#notebookId, {
                noCache: true
            });
            nn(this.#model).replaceFrom(reloaded);
            nn(this.#cellList).updateBlocks((reloaded.blocks ?? []) as unknown as BlockData[]);
            this.#execState.discard(blockId);
        } catch (e: unknown) {
            logError('Failed to delete block:', e);
        }
    }

    /**
     * Запускает одну code-ячейку. Если WS открыт — стримит stdout/stderr
     * чанками через WS и ждёт execute_completed. Иначе fallback на REST
     * /runner/execute. В любом случае предварительно сохраняет содержимое
     * ячейки и обновляет execution-counter + output после завершения.
     *
     * Блок идентифицируется на сервере по id (не по позиции) — иначе при
     * pending reorder сервер может прислать в качестве кода старую ячейку с
     * этой позиции.
     * @param blockId - идентификатор запускаемого блока
     */
    async #runSingleBlock(blockId: number | string): Promise<void> {
        const cell = nn(this.#cellList).getCellByBlockId(blockId);
        if (!cell || !(cell instanceof CodeCell)) return;

        await this.#maybeSaveCellContent(blockId, cell);

        cell.setRunning(true);

        if (this.#ws && this.#ws.isOpen()) {
            this.#streamBuffer.start(blockId);
            cell.setOutput({});
            this.#ws.executeBlock(blockId);
            await new Promise<void>((resolve) => {
                this.#streamingResolve = resolve;
            });
        } else {
            try {
                const result = await this.#runnerApi.executeBlock(this.#notebookId, blockId);
                const out = runnerResultToCellOutput(result as unknown as Record<string, unknown>);
                const execNum = this.#execState.assignNextNumber(blockId);
                this.#execState.setOutput(blockId, out);
                cell.setExecutionNumber(execNum);
                cell.setOutput(out);
            } catch (e: unknown) {
                const errOut: CellOutput = { error: (e as Error).message || String(e) };
                this.#execState.setOutput(blockId, errOut);
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

        const savedOutputs = new Map<number | string, CellOutput>();
        codeCells.forEach((c) => {
            const blockId = c.getBlockId();
            if (this.#execState.hasOutput(blockId)) {
                savedOutputs.set(blockId, nn(this.#execState.getOutput(blockId)));
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

                const out = runnerResultToCellOutput(r);
                if (out.error !== undefined) {
                    this.#execState.setOutput(blockId, out);
                    c.setOutput(out);
                    return;
                }

                const execNum = this.#execState.assignNextNumber(blockId);
                this.#execState.setOutput(blockId, out);
                c.setExecutionNumber(execNum);
                c.setOutput(out);
            });
        } catch (e: unknown) {
            const errOut: CellOutput = {
                error: `Run-all failed: ${String((e as Error).message || e)}`
            };
            codeCells.forEach((c) => {
                const blockId = c.getBlockId();
                if (savedOutputs.has(blockId)) {
                    c.setOutput(savedOutputs.get(blockId));
                } else {
                    this.#execState.setOutput(blockId, errOut);
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
        this.#execState.forEachNumber((n, id) => {
            const cell = nn(this.#cellList).getCellByBlockId(id);
            if (cell && cell instanceof CodeCell) cell.setExecutionNumber(n);
        });
        this.#execState.forEachOutput((out, id) => {
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
    async #maybeSaveCellContent(blockId: number | string, cell: CellContentSource): Promise<void> {
        try {
            await this.#notebookApi.updateBlockContent(
                this.#notebookId,
                blockId,
                cell.getContent()
            );
        } catch {
            /* tolerate */
        }
    }

    /**
     * Экспортирует текущий блокнот в формат Jupyter `.ipynb`. Сначала
     * сохраняет все ячейки, затем строит nbformat-4 структуру:
     * - text-ячейки → cell_type=markdown
     * - code-ячейки → cell_type=code с outputs из #execState
     *   (stdout/stderr → stream, result → execute_result, остальное → display_data)
     * Скачивает результат через временный <a> элемент с blob: URL.
     */
    async #exportAsIpynb(): Promise<void> {
        await this.#saveAll();
        const cells = nn(this.#cellList).getAllCells();
        const exportCells: ExportCell[] = cells.map((c) => ({
            blockId: c.getBlockId(),
            content: c.getContent(),
            isCode: c instanceof CodeCell
        }));
        const ipynb = cellsToIpynb(exportCells, this.#execState.outputsMap());
        const blob = new Blob([JSON.stringify(ipynb, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.#model?.title ?? 'Untitled'}.ipynb`;
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
                const blocks = ipynbToBlocks(ipynb);
                const title = file.name.replace(/\.ipynb$/, '') || 'Imported';
                const notebook = await this.#notebookApi.importNotebook(title, blocks);
                nn(Router.getInstance()).navigate(`/notebooks/${String(notebook.id)}`);
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
            await this.#notebookApi.reorderBlocks(this.#notebookId, blockIds);
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
            this.#model?.title ?? 'Untitled',
            this.#model?.isPublic ?? false
        );
    }

    /**
     * Переименовывает блокнот через PUT /notebooks/:id и обновляет
     * локальное состояние из ответа (мерж в #notebook). Ошибки логируются.
     * @param newTitle - новое название блокнота
     */
    async #renameNotebook(newTitle: string): Promise<void> {
        try {
            const updated = await this.#notebookApi.renameNotebook(this.#notebookId, newTitle);
            nn(this.#model).mergeFrom(updated);
        } catch (e: unknown) {
            logError('Failed to rename notebook:', e);
        }
    }

    /**
     * Строит адаптер NotebookSearchAdapter, через который NotebookSidebar
     * получает доступ к ячейкам блокнота для поиска/замены, не зная про
     * конкретные классы CodeCell/TextCell. Адаптер делегирует операции
     * на CellList и инкапсулирует instanceof-проверки.
     * @returns адаптер для передачи в конструктор NotebookSidebar
     */
    #buildSearchAdapter(): NotebookSearchAdapter {
        return {
            getSearchableCells: (): SearchableCellSnapshot[] =>
                nn(this.#cellList)
                    .getAllCells()
                    .map((c) => ({
                        id: c.getBlockId(),
                        kind: c instanceof CodeCell ? 'code' : 'text',
                        content: c.getContent()
                    })),
            clearAllHighlights: (): void => {
                nn(this.#cellList)
                    .getAllCells()
                    .filter((c): c is TextCell => c instanceof TextCell)
                    .forEach((c) => {
                        c.clearHighlights();
                    });
            },
            focusMatch: (m: SearchMatch): void => {
                const cell = nn(this.#cellList).getCellByBlockId(m.blockId);
                if (!cell) return;
                if (m.kind === 'code' && cell instanceof CodeCell) {
                    cell.highlightRange(m.start, m.end);
                } else if (m.kind === 'text' && cell instanceof TextCell) {
                    cell.highlightMatch(m.index, m.start, m.end);
                }
            },
            getContent: (blockId: number | string): string | null => {
                const cell = this.#cellList?.getCellByBlockId(blockId);
                return cell?.getContent() ?? null;
            },
            setContent: (blockId: number | string, content: string): boolean => {
                const cell = this.#cellList?.getCellByBlockId(blockId);
                if (!cell || typeof cell.setContent !== 'function') return false;
                cell.setContent(content);
                return true;
            }
        };
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
        if (this.#statsWs) {
            this.#statsWs.close();
            this.#statsWs = null;
        }
        if (this.#shareModal) this.#shareModal.close();
        if (this.#cellList) this.#cellList.unmount();
        if (this.#sidebar) this.#sidebar.unmount();
        if (this.#toolbar) this.#toolbar.unmount();
        if (this.#header) this.#header.unmount();
        this.#root.innerHTML = '';
    }
}
