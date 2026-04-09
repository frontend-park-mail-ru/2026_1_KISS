/**
 * @module shared/components/code-cell/CodeCell
 */

import { BaseComponent } from '../base-component/BaseComponent.js';
import { CodeCellTemplate } from './CodeCell.template.js';

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
    #onRun;
    #isRunning = false;

    /**
     * @param {HTMLElement} parent
     * @param {Object} options
     * @param {BlockData} options.blockData -- данные блока (id + content)
     * @param {Function} [options.onMoveUp] -- вызывается при перемещении вверх
     * @param {Function} [options.onMoveDown] -- вызывается при перемещении вниз
     * @param {Function} [options.onCopy] -- вызывается при копировании
     * @param {Function} [options.onRun] -- вызывается при запуске кода
     */
    constructor(parent, { blockData, onMoveUp, onMoveDown, onCopy, onRun }) {
        super(null, parent);
        this.#blockData = blockData;
        this.#onMoveUp = onMoveUp;
        this.#onMoveDown = onMoveDown;
        this.#onCopy = onCopy;
        this.#onRun = onRun;
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
        if (!this._isMounted) return;
        super.unmount();
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

    /**
     * @returns {string} идентификатор блока
     */
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
     * @param {{stdout?: string[], stderr?: string[], result?: string, error?: string}} out
     */
    setOutput(out = {}) {
        const el = this._element.querySelector('.code-cell__output');
        const stdoutEl = el.querySelector('.code-cell__output-stdout');
        const stderrEl = el.querySelector('.code-cell__output-stderr');
        const resultEl = el.querySelector('.code-cell__output-result');

        const hasAny =
            (out.stdout?.length ?? 0) > 0 ||
            (out.stderr?.length ?? 0) > 0 ||
            !!out.result ||
            !!out.error;

        el.hidden = !hasAny;

        stdoutEl.textContent = out.stdout?.length ? out.stdout.join('\n') : '';

        const stderrText = [out.stderr?.join('\n') || '', out.error || '']
            .filter(Boolean)
            .join('\n');
        stderrEl.textContent = stderrText || '';

        resultEl.textContent = out.result || '';

        this._element.classList.toggle('code-cell--error', !!(out.stderr?.length || out.error));
    }

    /**
     * Скрыть и очистить output-область.
     */
    clearOutput() {
        const el = this._element.querySelector('.code-cell__output');
        if (!el) return;
        el.hidden = true;
        el.querySelector('.code-cell__output-stdout').textContent = '';
        el.querySelector('.code-cell__output-stderr').textContent = '';
        el.querySelector('.code-cell__output-result').textContent = '';
        this._element.classList.remove('code-cell--error');
    }
}
