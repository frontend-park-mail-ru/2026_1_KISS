import { NotebookHeader } from '../../widgets/notebook-header/NotebookHeader.js';
import { NotebookToolbar } from '../../widgets/notebook-toolbar/NotebookToolbar.js';
import { NotebookSidebar } from '../../widgets/notebook-sidebar/NotebookSidebar.js';
import { CellList } from '../../widgets/cell-list/CellList.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';

export class BlocksPage {
    #root;
    #notebookId;
    #httpClient;
    #header;
    #toolbar;
    #sidebar;
    #cellList;
    #notebook = null;
    #username = '';

    constructor(root, params) {
        this.#root = root;
        this.#notebookId = params.id;
        this.#httpClient = new HttpClient();
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
            user: { username: this.#username, initials },
            onRename: (newTitle) => this.#renameNotebook(newTitle),
            onProfile: () => {
                // TODO: navigate to profile page
            },
            onLogout: async () => {
                try {
                    await this.#httpClient.post('/auth/logout');
                } catch (_e) { /* ignore */ }
                Router.getInstance().navigate('/sign');
            }
        });
        this.#header.mount();

        this.#toolbar = new NotebookToolbar(headerArea, {
            onAddCode: () => this.#createBlock('code'),
            onAddText: () => this.#createBlock('text'),
            onRunAll: () => {}
        });
        this.#toolbar.mount();

        const body = document.createElement('div');
        body.className = 'blocks-page__body';
        page.appendChild(body);

        const sidebarArea = document.createElement('div');
        sidebarArea.className = 'blocks-page__sidebar';
        body.appendChild(sidebarArea);

        this.#sidebar = new NotebookSidebar(sidebarArea);
        this.#sidebar.mount();

        const main = document.createElement('main');
        main.className = 'blocks-page__main';
        body.appendChild(main);

        this.#cellList = new CellList(main);
        this.#cellList.mount();

        this.#root.appendChild(page);

        const blocks = this.#notebook.blocks || [];
        this.#cellList.updateBlocks(blocks);
    }

    async #createBlock(type) {
        try {
            const body = { type, content: '' };
            if (type === 'code') {
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
            this.#cellList.updateBlocks(notebook.blocks || []);
        } catch (e) {
            console.error('Failed to create block:', e);
        }
    }

    async #renameNotebook(newTitle) {
        try {
            const response = await this.#httpClient.put(`/notebooks/${this.#notebookId}`, {
                title: newTitle
            });
            if (response.ok) {
                this.#notebook.title = newTitle;
            }
        } catch (e) {
            console.error('Failed to rename notebook:', e);
        }
    }

    destroy() {
        if (this.#cellList) this.#cellList.unmount();
        if (this.#sidebar) this.#sidebar.unmount();
        if (this.#toolbar) this.#toolbar.unmount();
        if (this.#header) this.#header.unmount();
        this.#root.innerHTML = '';
    }
}
