import { NotebookHeader } from '../../widgets/notebook-header/NotebookHeader.js';
import { NotebookToolbar } from '../../widgets/notebook-toolbar/NotebookToolbar.js';
import { NotebookSidebar } from '../../widgets/notebook-sidebar/NotebookSidebar.js';
import { CellList } from '../../widgets/cell-list/CellList.js';
import { CodeCell } from '../../shared/components/code-cell/CodeCell.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { RunnerApi } from '../../shared/api/RunnerApi.js';
import { FindEngine } from '../../shared/search/FindEngine.js';
import { Router } from '../../shared/router/Router.js';

export class BlocksPage {
    #root;
    #notebookId;
    #header;
    #toolbar;
    #sidebar;
    #cellList;
    #notebook = null;
    #username = '';
    #avatarUrl = '';
    #httpClient;
    #runnerApi;

    // Сохранение execution state при re-renders (move, add, reload)
    #executionCounter = 0;
    #execNumbers = new Map(); // blockId -> execution number
    #lastOutputs = new Map(); // blockId -> output object
    #beforeUnloadHandler = null;

    // Find/Replace state
    #findEngine = new FindEngine();

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
        this.#header = new NotebookHeader(headerArea, {
            filename: this.#notebook.title || 'Untitled',
            user: { username: this.#username, initials, avatarUrl: this.#avatarUrl },
            onRename: (newTitle) => this.#renameNotebook(newTitle),
            onProfile: () => Router.getInstance().navigate('/profile'),
            onLogout: async () => {
                try {
                    await this.#httpClient.post('/auth/logout');
                } catch (_e) {
                    /* ignore */
                }
                Router.getInstance().navigate('/sign');
            }
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
            onDeleteCell: (blockId) => this.#deleteBlock(blockId)
        });
        this.#cellList.mount();

        this.#root.appendChild(page);

        const blocks = this.#notebook.blocks || [];
        this.#cellList.updateBlocks(blocks);

        // Остановка runner-сессии при закрытии вкладки / F5
        this.#beforeUnloadHandler = () => {
            if (this.#notebookId) this.#runnerApi.stopSessionBeacon(this.#notebookId);
        };
        window.addEventListener('beforeunload', this.#beforeUnloadHandler);
    }

    async #createBlock(type) {
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
                result: result.result
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

        // Персист содержимого всех ячеек перед запуском
        for (const c of codeCells) {
            await this.#maybeSaveCellContent(c.getBlockId(), c);
        }

        codeCells.forEach((c) => {
            c.setRunning(true);
            c.clearOutput();
        });

        try {
            const results = await this.#runnerApi.executeFromPosition(this.#notebookId, 0);
            if (!Array.isArray(results)) return;
            results.forEach((r) => {
                const cell = this.#cellList.getCellByBlockId(r.block_id);
                if (!cell || !cell.setOutput) return;
                this.#executionCounter += 1;
                this.#execNumbers.set(r.block_id, this.#executionCounter);
                const out = { stdout: r.stdout, stderr: r.stderr, result: r.result };
                this.#lastOutputs.set(r.block_id, out);
                cell.setExecutionNumber(this.#executionCounter);
                cell.setOutput(out);
            });
        } catch (e) {
            const errOut = { error: `Run-all failed: ${e.message || e}` };
            codeCells.forEach((c) => {
                this.#lastOutputs.set(c.getBlockId(), errOut);
                c.setOutput(errOut);
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
        if (this.#cellList) this.#cellList.unmount();
        if (this.#sidebar) this.#sidebar.unmount();
        if (this.#toolbar) this.#toolbar.unmount();
        if (this.#header) this.#header.unmount();
        this.#root.innerHTML = '';
    }
}
