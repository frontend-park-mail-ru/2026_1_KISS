import { NotebookHeader } from '../../widgets/notebook-header/NotebookHeader.js';
import { NotebookToolbar } from '../../widgets/notebook-toolbar/NotebookToolbar.js';
import { NotebookSidebar } from '../../widgets/notebook-sidebar/NotebookSidebar.js';
import { CellList } from '../../widgets/cell-list/CellList.js';
import { CodeCell } from '../../shared/components/code-cell/CodeCell.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { RunnerApi } from '../../shared/api/RunnerApi.js';
import { FindEngine } from '../../shared/search/FindEngine.js';
import { Router } from '../../shared/router/Router.js';
import { ShareModal } from '../../widgets/share-modal/ShareModal.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import { NotebookWS } from '../../shared/api/NotebookWS.js';

export class BlocksPage {
    #root;
    #notebookId;
    #header;
    #toolbar;
    #sidebar;
    #cellList;
    #notebook = null;
    #userId = null;
    #username = '';
    #avatarUrl = '';
    #httpClient;
    #runnerApi;

    // Сохранение execution state при re-renders (move, add, reload)
    #executionCounter = 0;
    #execNumbers = new Map(); // blockId -> execution number
    #lastOutputs = new Map(); // blockId -> output object
    #beforeUnloadHandler = null;
    #feedbackModal = null;

    // Find/Replace state
    #findEngine = new FindEngine();

    /** @type {ShareModal} */
    #shareModal = null;

    /** @type {?NotebookWS} */
    #ws = null;

    constructor(root, params) {
        this.#root = root;
        this.#notebookId = params.id;
        this.#httpClient = HttpClient.getInstance();
        this.#runnerApi = new RunnerApi();
    }

    async render() {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                Router.getInstance().navigate('/sign');
                return;
            }
            const { data: user } = await response.json();
            this.#userId = user.id;
            this.#username = user.username;
            this.#avatarUrl = user.avatar_url || '';
        } catch (_e) {
            Router.getInstance().navigate('/sign');
            return;
        }

        try {
            const response = await this.#httpClient.get(`/notebooks/${this.#notebookId}`);
            if (!response.ok) {
                Router.getInstance().navigate('/files');
                return;
            }
            const { data: notebook } = await response.json();
            this.#notebook = notebook;
        } catch (_e) {
            Router.getInstance().navigate('/files');
            return;
        }

        this.#buildLayout();
    }

    #buildLayout() {
        const page = document.createElement('div');
        page.className = 'blocks-page';

        const headerArea = document.createElement('div');
        headerArea.className = 'blocks-page__header-area';
        page.appendChild(headerArea);

        const initials = this.#username.substring(0, 2).toUpperCase();
        const isOwner = this.#notebook.owner_id === this.#userId;
        this.#header = new NotebookHeader(headerArea, {
            filename: this.#notebook.title || 'Untitled',
            user: { username: this.#username, initials, avatarUrl: this.#avatarUrl },
            isOwner,
            onRename: isOwner ? (newTitle) => this.#renameNotebook(newTitle) : null,
            onSave: () => this.#saveAll(),
            onSaveAs: () => this.#exportAsIpynb(),
            onOpen: () => this.#importNotebook(),
            onProfile: () => Router.getInstance().navigate('/profile'),
            onFeedback: () => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            onLogout: async () => {
                try {
                    await this.#httpClient.post('/auth/logout');
                } catch (_e) {
                    /* ignore */
                }
                Router.getInstance().navigate('/sign');
            },
            onShare: isOwner ? () => this.#openShareModal() : null
        });
        this.#header.mount();

        this.#toolbar = new NotebookToolbar(headerArea, {
            onAddCode: () => this.#createBlock('code'),
            onAddText: () => this.#createBlock('text'),
            onRunAll: () => this.#runAllBlocks()
        });
        this.#toolbar.mount();

        const body = document.createElement('div');
        body.className = 'blocks-page__body';
        page.appendChild(body);

        const sidebarArea = document.createElement('div');
        sidebarArea.className = 'blocks-page__sidebar';
        body.appendChild(sidebarArea);

        this.#sidebar = new NotebookSidebar(sidebarArea, {
            onFind: (q) => this.#handleFind(q),
            onNext: (q) => this.#handleFindNav(q, 'next'),
            onPrev: (q) => this.#handleFindNav(q, 'prev'),
            onReplace: (q) => this.#handleReplace(q),
            onReplaceAll: (q) => this.#handleReplaceAll(q)
        });
        this.#sidebar.mount();

        const main = document.createElement('main');
        main.className = 'blocks-page__main';
        body.appendChild(main);

        this.#cellList = new CellList(main, {
            onRunCell: (blockId) => this.#runSingleBlock(blockId),
            onRerender: () => this.#reapplyCellState(),
            onDeleteCell: (blockId) => this.#deleteBlock(blockId),
            onSaveContent: (blockId, content) => this.#saveTextCellContent(blockId, content),
            onCodeContentChange: (blockId, content) => this.#saveCodeCellContent(blockId, content),
            onReorder: (blockIds) => this.#reorderBlocks(blockIds)
        });
        this.#cellList.mount();

        this.#root.appendChild(page);

        const blocks = this.#notebook.blocks || [];
        this.#loadSavedOutputs(blocks);
        this.#cellList.updateBlocks(blocks);

        // Остановка runner-сессии при закрытии вкладки / F5
        this.#beforeUnloadHandler = () => {
            if (this.#notebookId) this.#runnerApi.stopSessionBeacon(this.#notebookId);
        };
        window.addEventListener('beforeunload', this.#beforeUnloadHandler);

        this.#openWebSocket();
    }

    #openWebSocket() {
        // Первый onConnect срабатывает сразу после buildLayout, ноутбук
        // только что загружен — пропускаем resync, чтобы не перерисовать
        // свежие ячейки. Resync нужен лишь при переподключениях.
        let skipNextResync = true;
        this.#ws = new NotebookWS(this.#notebookId, {
            onEvent: (event) => this.#handleWSEvent(event),
            onConnect: () => {
                if (skipNextResync) {
                    skipNextResync = false;
                    return;
                }
                this.#resyncFromServer();
            },
            onClose: () => {}
        });
        this.#ws.connect();
    }

    /**
     * Обработка события сервера. Не фильтруем по actor_id — это блокировало
     * бы корректные апдейты во второй вкладке того же пользователя. Защита
     * от перетирания каретки сделана в applyRemoteEvent (skip, если фокус
     * сейчас в этой ячейке) и в applyBlockAdded/Deleted через дедуп по id.
     * @param {{type: string, actor_id?: number, block?: object, block_id?: number, message?: string}} event
     */
    #handleWSEvent(event) {
        if (!event || !event.type) return;
        if (event.type === 'error') {
            console.warn('WS error:', event.message);
            return;
        }

        switch (event.type) {
            case 'block_added':
            case 'block_updated':
            case 'block_deleted':
                this.#cellList.applyRemoteEvent(event);
                break;
            case 'notebook_updated':
                this.#resyncFromServer();
                break;
            default:
                break;
        }
    }

    /**
     * Перезагрузить ноутбук с сервера. Нужно после reconnect (события
     * могли быть пропущены — Hub дропает при переполнении буфера) и
     * после notebook_updated. Если фокус в одной из ячеек — не делаем
     * full re-render, ограничиваемся обновлением метаданных.
     */
    async #resyncFromServer() {
        if (!this.#notebookId) return;
        try {
            const response = await this.#httpClient.get(`/notebooks/${this.#notebookId}`);
            if (!response.ok) return;
            const { data: notebook } = await response.json();
            const newTitle = notebook.title || 'Untitled';
            if (this.#notebook && newTitle !== this.#notebook.title && this.#header) {
                this.#header.setFilename(newTitle);
            }
            this.#notebook = notebook;
            if (!this.#cellList.containsActiveElement()) {
                this.#loadSavedOutputs(notebook.blocks || []);
                this.#cellList.updateBlocks(notebook.blocks || []);
            }
        } catch {
            /* tolerate */
        }
    }

    async #saveCodeCellContent(blockId, content) {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/blocks/${blockId}`, {
                content
            });
        } catch {
            /* tolerate */
        }
    }

    async #saveTextCellContent(blockId, content) {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/blocks/${blockId}`, {
                content
            });
        } catch {
            /* tolerate */
        }
    }

    async #saveAll() {
        this.#header.showSaveIndicator();
        const cells = this.#cellList.getAllCells();
        const promises = cells.map((cell) =>
            this.#maybeSaveCellContent(cell.getBlockId(), cell)
        );
        await Promise.all(promises);
    }

    async #saveAllTextCells() {
        const allCells = this.#cellList.getAllCells();
        for (const cell of allCells) {
            if (!(cell instanceof CodeCell)) {
                await this.#maybeSaveCellContent(cell.getBlockId(), cell);
            }
        }
    }

    async #createBlock(type) {
        await this.#saveAllTextCells();
        try {
            const body = { type, content: '' };
            if (type === 'code') {
                // TODO(runner-r): бэкенд сейчас хардкодит Python в runner_service.go:58.
                // Когда это будет исправлено -- добавить language selector в toolbar.
                body.language = 'python';
            }
            const response = await this.#httpClient.post(
                `/notebooks/${this.#notebookId}/blocks`,
                body
            );
            if (!response.ok) return;

            const reloadResponse = await this.#httpClient.get(`/notebooks/${this.#notebookId}`);
            if (!reloadResponse.ok) return;
            const { data: notebook } = await reloadResponse.json();
            this.#notebook = notebook;
            // updateBlocks автоматически зовёт onRerender → #reapplyCellState
            this.#cellList.updateBlocks(notebook.blocks || []);
        } catch (e) {
            console.error('Failed to create block:', e);
        }
    }

    async #deleteBlock(blockId) {
        try {
            const response = await this.#httpClient.delete(
                `/notebooks/${this.#notebookId}/blocks/${blockId}`
            );
            if (!response.ok) return;

            const reloadResponse = await this.#httpClient.get(`/notebooks/${this.#notebookId}`);
            if (!reloadResponse.ok) return;
            const { data: notebook } = await reloadResponse.json();
            this.#notebook = notebook;
            this.#cellList.updateBlocks(notebook.blocks || []);
            this.#execNumbers.delete(blockId);
            this.#lastOutputs.delete(blockId);
        } catch (e) {
            console.error('Failed to delete block:', e);
        }
    }

    /**
     * Исполнить один блок по id. Вызывается из CellList onRunCell.
     * @param {number|string} blockId
     */
    async #runSingleBlock(blockId) {
        const cell = this.#cellList.getCellByBlockId(blockId);
        if (!cell) return;
        const position = this.#cellList.getBlockPositionById(blockId);
        if (position < 0) return;

        // Сохранить актуальное содержимое textarea на бэк перед исполнением,
        // иначе runner выполнит старую версию из БД.
        await this.#maybeSaveCellContent(blockId, cell);

        cell.setRunning(true);
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
        } catch (e) {
            const errOut = { error: e.message || String(e) };
            this.#lastOutputs.set(blockId, errOut);
            cell.setOutput(errOut);
        } finally {
            cell.setRunning(false);
        }
    }

    /**
     * Исполнить все code-блоки с нулевой позиции.
     */
    async #runAllBlocks() {
        const codeCells = this.#cellList.getCodeCellsInOrder();
        if (codeCells.length === 0) return;

        for (const c of codeCells) {
            await this.#maybeSaveCellContent(c.getBlockId(), c);
        }

        const savedOutputs = new Map();
        codeCells.forEach((c) => {
            const blockId = c.getBlockId();
            if (this.#lastOutputs.has(blockId)) {
                savedOutputs.set(blockId, this.#lastOutputs.get(blockId));
            }
        });

        codeCells.forEach((c) => c.setRunning(true));

        try {
            const results = await this.#runnerApi.executeFromPosition(this.#notebookId, 0);
            if (!Array.isArray(results)) return;

            const resultMap = new Map();
            results.forEach((r) => resultMap.set(r.block_id, r));

            codeCells.forEach((c) => {
                const blockId = c.getBlockId();
                const r = resultMap.get(blockId);

                if (!r) {
                    if (savedOutputs.has(blockId)) {
                        c.setOutput(savedOutputs.get(blockId));
                    }
                    return;
                }

                if (r.error) {
                    const errOut = { error: r.error };
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
                };
                this.#lastOutputs.set(blockId, out);
                c.setExecutionNumber(this.#executionCounter);
                c.setOutput(out);
            });
        } catch (e) {
            const errOut = { error: `Run-all failed: ${e.message || e}` };
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
            codeCells.forEach((c) => c.setRunning(false));
        }
    }

    /**
     * Переприменить сохранённые execution numbers и outputs после re-render (например, move).
     * Вызывать после каждого `cellList.updateBlocks`.
     */
    #reapplyCellState() {
        this.#execNumbers.forEach((n, id) => {
            const cell = this.#cellList.getCellByBlockId(id);
            if (cell && cell.setExecutionNumber) cell.setExecutionNumber(n);
        });
        this.#lastOutputs.forEach((out, id) => {
            const cell = this.#cellList.getCellByBlockId(id);
            if (cell && cell.setOutput) cell.setOutput(out);
        });
    }

    /**
     * Сохранить актуальное содержимое ячейки на бэк через PUT.
     * Fire-and-forget (ошибки глотаются) -- бэк может не поддерживать этот endpoint.
     * @param {number|string} blockId
     * @param {{getContent: Function}} cell
     */
    async #maybeSaveCellContent(blockId, cell) {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/blocks/${blockId}`, {
                content: cell.getContent()
            });
        } catch {
            /* tolerate */
        }
    }

    #loadSavedOutputs(blocks) {
        for (const block of blocks) {
            if (!block.outputs || block.outputs.length === 0) continue;
            if (this.#lastOutputs.has(block.id)) continue;
            const out = {};
            for (const o of block.outputs) {
                if (o.output_type === 'stdout') out.stdout = [o.content];
                else if (o.output_type === 'stderr') out.stderr = [o.content];
                else if (o.output_type === 'result') out.result = o.content;
                else {
                    if (!out.outputs) out.outputs = [];
                    out.outputs.push({ mime_type: o.output_type, data: o.content });
                }
            }
            this.#lastOutputs.set(block.id, out);
        }
    }

    async #exportAsIpynb() {
        await this.#saveAll();
        const cells = this.#cellList.getAllCells();
        const ipynbCells = cells.map((cell) => {
            const blockId = cell.getBlockId();
            const content = cell.getContent();
            const isCode = cell instanceof CodeCell;
            const source = content
                ? content.split('\n').map((l, i, a) => (i < a.length - 1 ? l + '\n' : l))
                : [];

            if (!isCode) {
                return { cell_type: 'markdown', metadata: {}, source };
            }

            const out = this.#lastOutputs.get(blockId);
            const outputs = [];
            if (out) {
                if (out.stdout?.length) {
                    outputs.push({
                        output_type: 'stream',
                        name: 'stdout',
                        text: out.stdout.map((s) => s + '\n')
                    });
                }
                if (out.stderr?.length) {
                    outputs.push({
                        output_type: 'stream',
                        name: 'stderr',
                        text: out.stderr.map((s) => s + '\n')
                    });
                }
                if (out.result) {
                    outputs.push({
                        output_type: 'execute_result',
                        execution_count: null,
                        data: { 'text/plain': [out.result] },
                        metadata: {}
                    });
                }
                if (out.outputs) {
                    for (const o of out.outputs) {
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
        a.download = (this.#notebook?.title || 'Untitled') + '.ipynb';
        a.click();
        URL.revokeObjectURL(url);
    }

    #importNotebook() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ipynb';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const ipynb = JSON.parse(text);

                const blocks = (ipynb.cells || []).map((cell, i) => {
                    const content = Array.isArray(cell.source)
                        ? cell.source.join('')
                        : cell.source || '';
                    const type = cell.cell_type === 'code' ? 'code' : 'text';
                    const language = type === 'code' ? 'python' : 'markdown';
                    const outputs = [];

                    if (type === 'code' && cell.outputs) {
                        let pos = 0;
                        for (const o of cell.outputs) {
                            if (o.output_type === 'stream') {
                                const t = Array.isArray(o.text) ? o.text.join('') : o.text || '';
                                outputs.push({
                                    output_type: o.name || 'stdout',
                                    content: t,
                                    position: pos++
                                });
                            } else if (
                                o.output_type === 'execute_result' ||
                                o.output_type === 'display_data'
                            ) {
                                if (o.data) {
                                    for (const [mime, val] of Object.entries(o.data)) {
                                        const c = Array.isArray(val) ? val.join('') : String(val);
                                        outputs.push({
                                            output_type: mime === 'text/plain' ? 'result' : mime,
                                            content: c,
                                            position: pos++
                                        });
                                    }
                                }
                            } else if (o.output_type === 'error') {
                                const tb = (o.traceback || []).join('\n');
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
                    const { data: notebook } = await resp.json();
                    Router.getInstance().navigate(`/notebooks/${notebook.id}`);
                }
            } catch (err) {
                console.error('Failed to import notebook:', err);
            }
        };
        input.click();
    }

    async #reorderBlocks(blockIds) {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/reorder`, {
                block_ids: blockIds
            });
        } catch {
            /* tolerate */
        }
    }

    #openShareModal() {
        if (!this.#shareModal) {
            this.#shareModal = new ShareModal();
        }
        this.#shareModal.open(
            this.#notebookId,
            this.#notebook?.title || 'Untitled',
            this.#notebook?.is_public ?? false
        );
    }

    async #renameNotebook(newTitle) {
        try {
            const response = await this.#httpClient.put(`/notebooks/${this.#notebookId}`, {
                title: newTitle
            });
            if (response.ok) {
                const { data: notebook } = await response.json();
                Object.assign(this.#notebook, notebook);
            }
        } catch (e) {
            console.error('Failed to rename notebook:', e);
        }
    }

    /**
     * Собрать ячейки для поиска в формате, понятном FindEngine.
     * Читаем живой getContent() (а не this.#notebook.blocks) -- пользователь
     * мог редактировать ячейки с момента загрузки.
     * @returns {Array<{id: number|string, kind: 'code'|'text', content: string}>}
     */
    #collectSearchableCells() {
        return this.#cellList.getAllCells().map((c) => ({
            id: c.getBlockId(),
            kind: c instanceof CodeCell ? 'code' : 'text',
            content: c.getContent()
        }));
    }

    #handleFind({ query, caseSensitive }) {
        const cells = this.#collectSearchableCells();
        const total = this.#findEngine.search(cells, query, caseSensitive);
        this.#sidebar.setMatchCount(this.#findEngine.index(), total);
        if (total > 0) this.#focusCurrentMatch();
    }

    #handleFindNav(query, direction) {
        if (this.#findEngine.total() === 0) {
            this.#handleFind(query);
            return;
        }
        const m = direction === 'next' ? this.#findEngine.next() : this.#findEngine.prev();
        if (m) {
            this.#sidebar.setMatchCount(this.#findEngine.index(), this.#findEngine.total());
            this.#focusCurrentMatch();
        }
    }

    #focusCurrentMatch() {
        // Сначала сбросить все highlights в text-ячейках
        this.#cellList
            .getAllCells()
            .filter((c) => typeof c.clearHighlights === 'function')
            .forEach((c) => c.clearHighlights());

        const m = this.#findEngine.current();
        if (!m) return;
        const cell = this.#cellList.getCellByBlockId(m.blockId);
        if (!cell) return;

        if (m.kind === 'code' && typeof cell.highlightRange === 'function') {
            cell.highlightRange(m.start, m.end);
        } else if (m.kind === 'text' && typeof cell.highlightMatch === 'function') {
            cell.highlightMatch(m.index, m.start, m.end);
        }
    }

    #handleReplace({ query, replacement, caseSensitive }) {
        if (this.#findEngine.total() === 0) {
            this.#handleFind({ query, caseSensitive });
            if (this.#findEngine.total() === 0) return;
        }
        const m = this.#findEngine.current();
        if (!m) return;
        const cell = this.#cellList.getCellByBlockId(m.blockId);
        if (!cell || typeof cell.setContent !== 'function') return;

        const content = cell.getContent();
        const updated = content.substring(0, m.start) + replacement + content.substring(m.end);
        cell.setContent(updated);

        // Пересчитать matches и перейти к следующему
        this.#handleFind({ query, caseSensitive });
    }

    #handleReplaceAll({ query, replacement, caseSensitive }) {
        if (!query) return;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
        for (const cell of this.#cellList.getAllCells()) {
            if (typeof cell.setContent !== 'function') continue;
            const original = cell.getContent();
            const updated = original.replace(re, replacement);
            if (updated !== original) cell.setContent(updated);
        }
        this.#findEngine.reset();
        this.#sidebar.setMatchCount(-1, 0);
    }

    destroy() {
        // Остановить runner-сессию (fire-and-forget)
        if (this.#notebookId) {
            this.#runnerApi.stopSession(this.#notebookId);
        }
        // Снять beforeunload listener
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
