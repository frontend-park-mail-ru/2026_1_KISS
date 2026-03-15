/**
 * @module pages/blocks/BlocksPage
 *
 * Страница редактора ноутбука (/notebooks/:id).
 * Загружает данные ноутбука и пользователя, рендерит header, toolbar,
 * sidebar и список ячеек.
 */

import { NotebookHeader } from '../../widgets/notebook-header/NotebookHeader.js';
import { NotebookToolbar } from '../../widgets/notebook-toolbar/NotebookToolbar.js';
import { NotebookSidebar } from '../../widgets/notebook-sidebar/NotebookSidebar.js';
import { CellList } from '../../widgets/cell-list/CellList.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';

/** @typedef {import('../../shared/types.js').Notebook} Notebook */

/**
 * Страница /notebooks/:id -- редактор ноутбука с code/text ячейками.
 * При отсутствии авторизации редиректит на /sign,
 * при ошибке загрузки ноутбука -- на /files.
 */
export class BlocksPage {
    /** @type {HTMLElement} */
    #root;

    /** @type {string} */
    #notebookId;

    /** @type {NotebookHeader} */
    #header;

    /** @type {NotebookToolbar} */
    #toolbar;

    /** @type {NotebookSidebar} */
    #sidebar;

    /** @type {CellList} */
    #cellList;

    /** @type {?Notebook} */
    #notebook = null;

    /** @type {string} */
    #username = '';
    #avatarUrl = '';
    #httpClient;

    /**
     * @param {HTMLElement} root -- корневой элемент
     * @param {Object} params -- параметры маршрута
     * @param {string} params.id -- идентификатор ноутбука
     */
    constructor(root, params) {
        this.#root = root;
        this.#notebookId = params.id;
        this.#httpClient = HttpClient.getInstance();
    }

    /**
     * Загружает данные пользователя и ноутбука, затем строит layout.
     *
     * @async
     * @returns {Promise<void>}
     */
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

    /**
     * Собирает DOM-структуру страницы: создаёт области для header, toolbar, sidebar и cell list, монтирует все виджеты и загружает блоки ноутбука.
     *
     * @private
     */
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

    /**
     * Создаёт новый блок через API и перезагружает список ячеек.
     *
     * @private
     * @async
     * @param {string} type -- 'code' или 'text'
     */
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

    /**
     * Переименовывает ноутбук через PUT /notebooks/:id.
     *
     * @private
     * @async
     * @param {string} newTitle -- новое название
     */
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
     * Размонтирует все виджеты и очищает DOM.
     */
    destroy() {
        if (this.#cellList) this.#cellList.unmount();
        if (this.#sidebar) this.#sidebar.unmount();
        if (this.#toolbar) this.#toolbar.unmount();
        if (this.#header) this.#header.unmount();
        this.#root.innerHTML = '';
    }
}
