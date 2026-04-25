/**
 * @module shared/components/code-cell/CodeCell
 */

import { BaseComponent } from '../base-component/BaseComponent.js';
import { CodeCellTemplate } from './CodeCell.template.js';
import { ansiToHtml, stripTracebackDashes, handleCarriageReturns } from '../../utils/ansiToHtml.js';

/** @typedef {import('../../types.js').BlockData} BlockData */

/**
 * Ячейка Python-кода с нумерацией строк, авторесайзом и поддержкой Tab.
 *
 * @extends BaseComponent
 */
export class CodeCell extends BaseComponent {
    /** @type {BlockData} */
    #blockData;

    /** @type {Function} */
    #onMoveUp;

    /** @type {Function} */
    #onMoveDown;

    /** @type {Function} */
    #onCopy;

    /** @type {Function} */
    #onDelete;

    /** @type {Function} */
    #onRun;
    #isRunning = false;

    /** @type {?Function} */
    #onContentChange = null;

    /** @type {?number} */
    #contentChangeTimer = null;

    /** Задержка дебаунса автосейва кода через WebSocket (мс). */
    static #CONTENT_DEBOUNCE_MS = 400;

    /**
     * @param {HTMLElement} parent
     * @param {Object} options
     * @param {BlockData} options.blockData -- данные блока (id + content)
     * @param {Function} [options.onMoveUp] -- вызывается при перемещении вверх
     * @param {Function} [options.onMoveDown] -- вызывается при перемещении вниз
     * @param {Function} [options.onCopy] -- вызывается при копировании
     * @param {Function} [options.onRun] -- вызывается при запуске кода
     * @param {Function} [options.onContentChange] -- (id, content) при изменении кода (debounced)
     */
    constructor(
        parent,
        { blockData, onMoveUp, onMoveDown, onCopy, onDelete, onRun, onContentChange }
    ) {
        super(null, parent);
        this.#blockData = blockData;
        this.#onMoveUp = onMoveUp;
        this.#onMoveDown = onMoveDown;
        this.#onCopy = onCopy;
        this.#onDelete = onDelete;
        this.#onRun = onRun;
        this.#onContentChange = onContentChange || null;
        this.#render();
    }

    /**
     * Компилирует Handlebars-шаблон CodeCell с идентификатором и содержимым блока.
     *
     * @private
     */
    #render() {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = CodeCellTemplate({
            id: this.#blockData.id,
            content: this.#blockData.content || ''
        });
        this._element = tempContainer.firstElementChild;
    }

    mount() {
        if (this._isMounted) return;
        super.mount();
        this.#updateLineNumbers();
        this.#autoResize();
        this.#attachEvents();
    }

    unmount() {
        if (this.#contentChangeTimer) {
            clearTimeout(this.#contentChangeTimer);
            this.#contentChangeTimer = null;
        }
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Запланировать оповещение onContentChange — debounced, чтобы каждое
     * нажатие не летело на бэк.
     * @private
     */
    #scheduleContentChange() {
        if (!this.#onContentChange) return;
        if (this.#contentChangeTimer) clearTimeout(this.#contentChangeTimer);
        this.#contentChangeTimer = setTimeout(() => {
            this.#contentChangeTimer = null;
            this.#onContentChange(this.#blockData.id, this.getContent());
        }, CodeCell.#CONTENT_DEBOUNCE_MS);
    }

    /**
     * Сбросить отложенный onContentChange — например, перед вытолкнутым
     * сохранением «вручную» (Run, ручной save) во избежание двойной отправки.
     */
    flushContentChange() {
        if (!this.#contentChangeTimer) return;
        clearTimeout(this.#contentChangeTimer);
        this.#contentChangeTimer = null;
    }

    /**
     * Подключает обработчики: ввод текста (обновление нумерации + авторесайз), Tab (вставка 4 пробелов), Run и кнопки move/copy.
     *
     * @private
     */
    #attachEvents() {
        const textarea = this._element.querySelector('.code-cell__textarea');

        this._addListener(textarea, 'input', () => {
            this.#updateLineNumbers();
            this.#autoResize();
            this.#scheduleContentChange();
        });

        this._addListener(textarea, 'keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value =
                    textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
                this.#updateLineNumbers();
            }
        });

        const runBtn = this._element.querySelector('.code-cell__run-btn');
        this._addListener(runBtn, 'click', () => {
            if (this.#onRun && !this.#isRunning) this.#onRun(this.#blockData.id);
        });

        this._element.querySelectorAll('.code-cell__action-btn').forEach((btn) => {
            const action = btn.dataset.action;
            this._addListener(btn, 'click', () => {
                if (action === 'move-up' && this.#onMoveUp) this.#onMoveUp(this.#blockData.id);
                if (action === 'move-down' && this.#onMoveDown)
                    this.#onMoveDown(this.#blockData.id);
                if (action === 'copy' && this.#onCopy) this.#onCopy(this.#blockData.id);
                if (action === 'delete' && this.#onDelete) this.#onDelete(this.#blockData.id);
            });
        });
    }

    /**
     * Перестраивает нумерацию строк слева от textarea по количеству строк в содержимом.
     *
     * @private
     */
    #updateLineNumbers() {
        const textarea = this._element.querySelector('.code-cell__textarea');
        const lineNumbers = this._element.querySelector('.code-cell__line-numbers');
        const lines = textarea.value.split('\n');
        lineNumbers.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
    }

    /**
     * Подгоняет высоту textarea под содержимое, учитывая минимальную высоту блока редактора.
     *
     * @private
     */
    #autoResize() {
        const textarea = this._element.querySelector('.code-cell__textarea');
        textarea.style.height = 'auto';
        const scrollH = textarea.scrollHeight;
        const editorH = this._element.querySelector('.code-cell__editor').clientHeight;
        textarea.style.height = Math.max(scrollH, editorH) + 'px';
    }

    /**
     * @returns {string} текущее содержимое textarea
     */
    getContent() {
        return this._element.querySelector('.code-cell__textarea').value;
    }

    setContent(text) {
        const textarea = this._element.querySelector('.code-cell__textarea');
        textarea.value = text;
        this.#updateLineNumbers();
        this.#autoResize();
    }

    highlightRange(start, end) {
        const textarea = this._element.querySelector('.code-cell__textarea');
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start, end);
        this._element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    getBlockId() {
        return this.#blockData.id;
    }

    /**
     * Пометить ячейку как исполняющуюся (или остановленную).
     * Во время running: Run-кнопка disabled, execution number получает `*`, output очищается.
     * @param {boolean} isRunning
     */
    setRunning(isRunning) {
        this.#isRunning = isRunning;
        this._element.classList.toggle('code-cell--running', isRunning);
        if (isRunning) this.clearOutput();
    }

    /**
     * Установить execution number (Jupyter-стиль `[N]`).
     * @param {number|null} n
     */
    setExecutionNumber(n) {
        const el = this._element.querySelector('.code-cell__execution-number');
        if (el) el.textContent = `[${n ?? ' '}]`;
    }

    /**
     * Показать вывод исполнения ячейки.
     * Все тексты вставляются через textContent (безопасно, HTML не парсится).
     * @param {{stdout?: string[], stderr?: string[], result?: string, error?: string, outputs?: Array<{mime_type: string, data: string}>}} out
     */
    setOutput(out = {}) {
        const el = this._element.querySelector('.code-cell__output');
        const stdoutEl = el.querySelector('.code-cell__output-stdout');
        const stderrEl = el.querySelector('.code-cell__output-stderr');
        const resultEl = el.querySelector('.code-cell__output-result');
        const imagesEl = el.querySelector('.code-cell__output-images');

        const imageOutputs = (out.outputs ?? []).filter(
            (o) => o.mime_type === 'image/png' || o.mime_type === 'image/jpeg'
        );

        const hasAny =
            (out.stdout?.length ?? 0) > 0 ||
            (out.stderr?.length ?? 0) > 0 ||
            !!out.result ||
            !!out.error ||
            imageOutputs.length > 0;

        el.hidden = !hasAny;

        const stdoutText = out.stdout?.length ? out.stdout.join('\n') : '';
        stdoutEl.innerHTML = stdoutText ? ansiToHtml(handleCarriageReturns(stdoutText)) : '';

        const stderrText = [out.stderr?.join('\n') || '', out.error || '']
            .filter(Boolean)
            .join('\n');
        stderrEl.innerHTML = stderrText
            ? ansiToHtml(handleCarriageReturns(stripTracebackDashes(stderrText)))
            : '';

        // Если есть картинки — текстовый result типа "<Figure ...>" не нужен
        resultEl.textContent = imageOutputs.length ? '' : out.result || '';

        imagesEl.innerHTML = '';
        for (const output of imageOutputs) {
            const img = document.createElement('img');
            img.src = `data:${output.mime_type};base64,${output.data}`;
            img.className = 'code-cell__output-image';
            imagesEl.appendChild(img);
        }

        this._element.classList.toggle('code-cell--error', !!(out.stderr?.length || out.error));
    }

    /**
     * Скрыть и очистить output-область.
     */
    clearOutput() {
        const el = this._element.querySelector('.code-cell__output');
        if (!el) return;
        el.hidden = true;
        el.querySelector('.code-cell__output-stdout').innerHTML = '';
        el.querySelector('.code-cell__output-stderr').innerHTML = '';
        el.querySelector('.code-cell__output-result').textContent = '';
        el.querySelector('.code-cell__output-images').innerHTML = '';
        this._element.classList.remove('code-cell--error');
    }
}
