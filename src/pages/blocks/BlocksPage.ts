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
import { ContainerStats } from '../../widgets/container-stats/ContainerStats.js';

export class BlocksPage {
    #root: HTMLElement;
    #notebookId: string;
    #header: NotebookHeader | null = null;
    #toolbar: NotebookToolbar | null = null;
    #containerStats: ContainerStats | null = null;
    #sidebar: NotebookSidebar | null = null;
    #cellList: CellList | null = null;
    #notebook: Record<string, unknown> | null = null;
    #userId: number | null = null;
    #username: string = '';
    #avatarUrl: string = '';
    #isAdmin: boolean = false;
    #httpClient: HttpClient;
    #runnerApi: RunnerApi;

    #executionCounter: number = 0;
    #execNumbers: Map<number | string, number> = new Map();
    #lastOutputs: Map<number | string, Record<string, unknown>> = new Map();
    #beforeUnloadHandler: (() => void) | null = null;
    #feedbackModal: FeedbackModal | null = null;

    #findEngine: FindEngine = new FindEngine();

    #shareModal: ShareModal | null = null;

    #ws: NotebookWS | null = null;

    constructor(root: HTMLElement, params: { id: string }) {
        this.#root = root;
        this.#notebookId = params.id;
        this.#httpClient = HttpClient.getInstance();
        this.#runnerApi = new RunnerApi();
    }

    async render(): Promise<void> {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                Router.getInstance()!.navigate('/sign');
                return;
            }
            const { data: user } = await response.json();
            this.#userId = user.id;
            this.#username = user.username;
            this.#avatarUrl = user.avatar_url || '';
            this.#isAdmin = user.is_admin || false;
        } catch (_e) {
            Router.getInstance()!.navigate('/sign');
            return;
        }

        try {
            const response = await this.#httpClient.get(`/notebooks/${this.#notebookId}`);
            if (!response.ok) {
                Router.getInstance()!.navigate('/files');
                return;
            }
            const { data: notebook } = await response.json();
            this.#notebook = notebook;
        } catch (_e) {
            Router.getInstance()!.navigate('/files');
            return;
        }

        this.#buildLayout();
    }

    #buildLayout(): void {
        const page = document.createElement('div');
        page.className = 'blocks-page';

        const headerArea = document.createElement('div');
        headerArea.className = 'blocks-page__header-area';
        page.appendChild(headerArea);

        const initials = this.#username.substring(0, 2).toUpperCase();
        const isOwner = this.#notebook!.owner_id === this.#userId;
        this.#header = new NotebookHeader(headerArea, {
            filename: (this.#notebook!.title as string) || 'Untitled',
            user: { username: this.#username, initials, avatarUrl: this.#avatarUrl },
            isOwner,
            onRename: isOwner ? (newTitle: string) => this.#renameNotebook(newTitle) : null,
            onSave: () => this.#saveAll(),
            onSaveAs: () => this.#exportAsIpynb(),
            onOpen: () => this.#importNotebook(),
            onProfile: () => Router.getInstance()!.navigate('/profile'),
            onAdmin: this.#isAdmin ? () => Router.getInstance()!.navigate('/admin') : null,
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
                Router.getInstance()!.navigate('/sign');
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

        const statsSlot = this.#toolbar.getStatsSlot();
        if (statsSlot) {
            this.#containerStats = new ContainerStats(statsSlot, { notebookId: this.#notebookId });
            this.#containerStats.mount();
        }

        const body = document.createElement('div');
        body.className = 'blocks-page__body';
        page.appendChild(body);

        const sidebarArea = document.createElement('div');
        sidebarArea.className = 'blocks-page__sidebar';
        body.appendChild(sidebarArea);

        this.#sidebar = new NotebookSidebar(sidebarArea, {
            onFind: (q: { query: string; caseSensitive: boolean }) => this.#handleFind(q),
            onNext: (q: { query: string; caseSensitive: boolean }) =>
                this.#handleFindNav(q, 'next'),
            onPrev: (q: { query: string; caseSensitive: boolean }) =>
                this.#handleFindNav(q, 'prev'),
            onReplace: (q: { query: string; replacement: string; caseSensitive: boolean }) =>
                this.#handleReplace(q),
            onReplaceAll: (q: { query: string; replacement: string; caseSensitive: boolean }) =>
                this.#handleReplaceAll(q)
        });
        this.#sidebar.mount();

        const main = document.createElement('main');
        main.className = 'blocks-page__main';
        body.appendChild(main);

        this.#cellList = new CellList(main, {
            onRunCell: (blockId: number | string) => this.#runSingleBlock(blockId),
            onRerender: () => this.#reapplyCellState(),
            onDeleteCell: (blockId: number | string) => this.#deleteBlock(blockId),
            onSaveContent: (blockId: number | string, content: string) =>
                this.#saveTextCellContent(blockId, content),
            onCodeContentChange: (blockId: number | string, content: string) =>
                this.#saveCodeCellContent(blockId, content),
            onReorder: (blockIds: (number | string)[]) => this.#reorderBlocks(blockIds)
        });
        this.#cellList.mount();

        this.#root.appendChild(page);

        const blocks = (this.#notebook!.blocks as BlockData[]) || [];
        this.#loadSavedOutputs(blocks as unknown as Record<string, unknown>[]);
        this.#cellList.updateBlocks(blocks);

        this.#beforeUnloadHandler = () => {
            if (this.#notebookId) this.#runnerApi.stopSessionBeacon(this.#notebookId);
        };
        window.addEventListener('beforeunload', this.#beforeUnloadHandler);

        this.#openWebSocket();
    }

    #openWebSocket(): void {
        let skipNextResync = true;
        this.#ws = new NotebookWS(this.#notebookId, {
            onEvent: (event: Record<string, unknown>) => this.#handleWSEvent(event),
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

    #handleWSEvent(event: Record<string, unknown>): void {
        if (!event || !event.type) return;
        if (event.type === 'error') {
            console.warn('WS error:', event.message);
            return;
        }

        switch (event.type) {
            case 'block_added':
            case 'block_updated':
            case 'block_deleted':
                this.#cellList!.applyRemoteEvent(
                    event as { type: string; block?: BlockData; block_id?: string | number }
                );
                break;
            case 'notebook_updated':
                this.#resyncFromServer();
                break;
            default:
                break;
        }
    }

    async #resyncFromServer(): Promise<void> {
        if (!this.#notebookId) return;
        try {
            const response = await this.#httpClient.get(`/notebooks/${this.#notebookId}`, {
                noCache: true
            });
            if (!response.ok) return;
            const { data: notebook } = await response.json();
            const newTitle = (notebook.title as string) || 'Untitled';
            if (this.#notebook && newTitle !== this.#notebook.title && this.#header) {
                this.#header.setFilename(newTitle);
            }
            this.#notebook = notebook;
            if (!this.#cellList!.containsActiveElement()) {
                this.#loadSavedOutputs(
                    ((notebook.blocks as BlockData[]) || []) as unknown as Record<string, unknown>[]
                );
                this.#cellList!.updateBlocks((notebook.blocks as BlockData[]) || []);
            }
        } catch {
            /* tolerate */
        }
    }

    async #saveCodeCellContent(blockId: number | string, content: string): Promise<void> {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/blocks/${blockId}`, {
                content
            });
        } catch {
            /* tolerate */
        }
    }

    async #saveTextCellContent(blockId: number | string, content: string): Promise<void> {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/blocks/${blockId}`, {
                content
            });
        } catch {
            /* tolerate */
        }
    }

    async #saveAll(): Promise<void> {
        this.#header!.showSaveIndicator();
        const cells = this.#cellList!.getAllCells();
        const promises = cells.map((cell) => this.#maybeSaveCellContent(cell.getBlockId(), cell));
        await Promise.all(promises);
    }

    async #saveAllTextCells(): Promise<void> {
        const allCells = this.#cellList!.getAllCells();
        for (const cell of allCells) {
            if (!(cell instanceof CodeCell)) {
                await this.#maybeSaveCellContent(cell.getBlockId(), cell);
            }
        }
    }

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
            const { data: notebook } = await reloadResponse.json();
            this.#notebook = notebook;
            this.#cellList!.updateBlocks((notebook.blocks as BlockData[]) || []);
        } catch (e: unknown) {
            console.error('Failed to create block:', e);
        }
    }

    async #deleteBlock(blockId: number | string): Promise<void> {
        try {
            const response = await this.#httpClient.delete(
                `/notebooks/${this.#notebookId}/blocks/${blockId}`
            );
            if (!response.ok) return;

            const reloadResponse = await this.#httpClient.get(`/notebooks/${this.#notebookId}`, {
                noCache: true
            });
            if (!reloadResponse.ok) return;
            const { data: notebook } = await reloadResponse.json();
            this.#notebook = notebook;
            this.#cellList!.updateBlocks((notebook.blocks as BlockData[]) || []);
            this.#execNumbers.delete(blockId);
            this.#lastOutputs.delete(blockId);
        } catch (e: unknown) {
            console.error('Failed to delete block:', e);
        }
    }

    async #runSingleBlock(blockId: number | string): Promise<void> {
        const cell = this.#cellList!.getCellByBlockId(blockId);
        if (!cell || !(cell instanceof CodeCell)) return;
        const position = this.#cellList!.getBlockPositionById(blockId);
        if (position < 0) return;

        await this.#maybeSaveCellContent(blockId, cell);

        cell.setRunning(true);
        try {
            const result = (await this.#runnerApi.executeBlock(
                this.#notebookId,
                position
            )) as Record<string, unknown>;
            this.#executionCounter += 1;
            this.#execNumbers.set(blockId, this.#executionCounter);
            this.#lastOutputs.set(blockId, {
                stdout: result.stdout,
                stderr: result.stderr,
                result: result.result,
                outputs: result.outputs
            });
            cell.setExecutionNumber(this.#executionCounter);
            cell.setOutput(this.#lastOutputs.get(blockId)!);
        } catch (e: unknown) {
            const errOut = { error: (e as Error).message || String(e) };
            this.#lastOutputs.set(blockId, errOut);
            cell.setOutput(errOut);
        } finally {
            cell.setRunning(false);
        }
    }

    async #runAllBlocks(): Promise<void> {
        const codeCells = this.#cellList!.getCodeCellsInOrder();
        if (codeCells.length === 0) return;

        for (const c of codeCells) {
            await this.#maybeSaveCellContent(c.getBlockId(), c);
        }

        const savedOutputs = new Map<number | string, Record<string, unknown>>();
        codeCells.forEach((c) => {
            const blockId = c.getBlockId();
            if (this.#lastOutputs.has(blockId)) {
                savedOutputs.set(blockId, this.#lastOutputs.get(blockId)!);
            }
        });

        codeCells.forEach((c) => c.setRunning(true));

        try {
            const results = await this.#runnerApi.executeFromPosition(this.#notebookId, 0);
            if (!Array.isArray(results)) return;

            const resultMap = new Map<number | string, Record<string, unknown>>();
            results.forEach((r: Record<string, unknown>) =>
                resultMap.set(r.block_id as number | string, r)
            );

            codeCells.forEach((c) => {
                const blockId = c.getBlockId();
                const r = resultMap.get(blockId);

                if (!r) {
                    if (savedOutputs.has(blockId)) {
                        c.setOutput(savedOutputs.get(blockId)!);
                    }
                    return;
                }

                if (r.error) {
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
            const errOut = { error: `Run-all failed: ${(e as Error).message || e}` };
            codeCells.forEach((c) => {
                const blockId = c.getBlockId();
                if (savedOutputs.has(blockId)) {
                    c.setOutput(savedOutputs.get(blockId)!);
                } else {
                    this.#lastOutputs.set(blockId, errOut);
                    c.setOutput(errOut);
                }
            });
        } finally {
            codeCells.forEach((c) => c.setRunning(false));
        }
    }

    #reapplyCellState(): void {
        this.#execNumbers.forEach((n, id) => {
            const cell = this.#cellList!.getCellByBlockId(id);
            if (cell && cell instanceof CodeCell) cell.setExecutionNumber(n);
        });
        this.#lastOutputs.forEach((out, id) => {
            const cell = this.#cellList!.getCellByBlockId(id);
            if (cell && cell instanceof CodeCell) cell.setOutput(out);
        });
    }

    async #maybeSaveCellContent(
        blockId: number | string,
        cell: { getContent(): string }
    ): Promise<void> {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/blocks/${blockId}`, {
                content: cell.getContent()
            });
        } catch {
            /* tolerate */
        }
    }

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
                    if (!out.outputs) out.outputs = [];
                    (out.outputs as Record<string, unknown>[]).push({
                        mime_type: o.output_type,
                        data: o.content
                    });
                }
            }
            this.#lastOutputs.set(block.id as number | string, out);
        }
    }

    async #exportAsIpynb(): Promise<void> {
        await this.#saveAll();
        const cells = this.#cellList!.getAllCells();
        const ipynbCells = cells.map((cell) => {
            const blockId = cell.getBlockId();
            const content = cell.getContent();
            const isCode = cell instanceof CodeCell;
            const source = content
                ? content
                      .split('\n')
                      .map((l: string, i: number, a: string[]) => (i < a.length - 1 ? l + '\n' : l))
                : [];

            if (!isCode) {
                return { cell_type: 'markdown', metadata: {}, source };
            }

            const out = this.#lastOutputs.get(blockId) as Record<string, unknown> | undefined;
            const outputs: Record<string, unknown>[] = [];
            if (out) {
                if ((out.stdout as string[])?.length) {
                    outputs.push({
                        output_type: 'stream',
                        name: 'stdout',
                        text: (out.stdout as string[]).map((s: string) => s + '\n')
                    });
                }
                if ((out.stderr as string[])?.length) {
                    outputs.push({
                        output_type: 'stream',
                        name: 'stderr',
                        text: (out.stderr as string[]).map((s: string) => s + '\n')
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
        a.download = ((this.#notebook?.title as string) || 'Untitled') + '.ipynb';
        a.click();
        URL.revokeObjectURL(url);
    }

    #importNotebook(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ipynb';
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const ipynb = JSON.parse(text);

                const blocks = ((ipynb.cells || []) as Record<string, unknown>[]).map((cell, i) => {
                    const content = Array.isArray(cell.source)
                        ? (cell.source as string[]).join('')
                        : (cell.source as string) || '';
                    const type = cell.cell_type === 'code' ? 'code' : 'text';
                    const language = type === 'code' ? 'python' : 'markdown';
                    const outputs: Record<string, unknown>[] = [];

                    if (type === 'code' && cell.outputs) {
                        let pos = 0;
                        for (const o of cell.outputs as Record<string, unknown>[]) {
                            if (o.output_type === 'stream') {
                                const t = Array.isArray(o.text)
                                    ? (o.text as string[]).join('')
                                    : (o.text as string) || '';
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
                                const tb = ((o.traceback || []) as string[]).join('\n');
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
                    Router.getInstance()!.navigate(`/notebooks/${notebook.id}`);
                }
            } catch (err: unknown) {
                console.error('Failed to import notebook:', err);
            }
        };
        input.click();
    }

    async #reorderBlocks(blockIds: (number | string)[]): Promise<void> {
        try {
            await this.#httpClient.put(`/notebooks/${this.#notebookId}/reorder`, {
                block_ids: blockIds
            });
        } catch {
            /* tolerate */
        }
    }

    #openShareModal(): void {
        if (!this.#shareModal) {
            this.#shareModal = new ShareModal();
        }
        this.#shareModal.open(
            this.#notebookId,
            (this.#notebook?.title as string) || 'Untitled',
            (this.#notebook?.is_public as boolean) ?? false
        );
    }

    async #renameNotebook(newTitle: string): Promise<void> {
        try {
            const response = await this.#httpClient.put(`/notebooks/${this.#notebookId}`, {
                title: newTitle
            });
            if (response.ok) {
                const { data: notebook } = await response.json();
                Object.assign(this.#notebook!, notebook);
            }
        } catch (e: unknown) {
            console.error('Failed to rename notebook:', e);
        }
    }

    #collectSearchableCells(): { id: number | string; kind: 'code' | 'text'; content: string }[] {
        return this.#cellList!.getAllCells().map((c) => ({
            id: c.getBlockId(),
            kind: (c instanceof CodeCell ? 'code' : 'text') as 'code' | 'text',
            content: c.getContent()
        }));
    }

    #handleFind({ query, caseSensitive }: { query: string; caseSensitive: boolean }): void {
        const cells = this.#collectSearchableCells();
        const total = this.#findEngine.search(cells, query, caseSensitive);
        this.#sidebar!.setMatchCount(this.#findEngine.index(), total);
        if (total > 0) this.#focusCurrentMatch();
    }

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
            this.#sidebar!.setMatchCount(this.#findEngine.index(), this.#findEngine.total());
            this.#focusCurrentMatch();
        }
    }

    #focusCurrentMatch(): void {
        this.#cellList!.getAllCells()
            .filter((c): c is TextCell => c instanceof TextCell)
            .forEach((c) => c.clearHighlights());

        const m = this.#findEngine.current();
        if (!m) return;
        const cell = this.#cellList!.getCellByBlockId(m.blockId);
        if (!cell) return;

        if (m.kind === 'code' && cell instanceof CodeCell) {
            cell.highlightRange(m.start, m.end);
        } else if (m.kind === 'text' && cell instanceof TextCell) {
            cell.highlightMatch(m.index, m.start, m.end);
        }
    }

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
        const cell = this.#cellList!.getCellByBlockId(m.blockId);
        if (!cell || typeof cell.setContent !== 'function') return;

        const content = cell.getContent();
        const updated = content.substring(0, m.start) + replacement + content.substring(m.end);
        cell.setContent(updated);

        this.#handleFind({ query, caseSensitive });
    }

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
        for (const cell of this.#cellList!.getAllCells()) {
            const original = cell.getContent();
            const updated = original.replace(re, replacement);
            if (updated !== original) cell.setContent(updated);
        }
        this.#findEngine.reset();
        this.#sidebar!.setMatchCount(-1, 0);
    }

    destroy(): void {
        if (this.#notebookId) {
            this.#runnerApi.stopSession(this.#notebookId);
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
        if (this.#containerStats) this.#containerStats.unmount();
        if (this.#toolbar) this.#toolbar.unmount();
        if (this.#header) this.#header.unmount();
        this.#root.innerHTML = '';
    }
}
