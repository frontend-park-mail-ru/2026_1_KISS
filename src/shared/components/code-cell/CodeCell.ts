import { BaseComponent } from '../base-component/BaseComponent.js';
import { CodeCellTemplate } from './CodeCell.template.js';
import { ansiToHtml, stripTracebackDashes, handleCarriageReturns } from '../../utils/ansiToHtml.js';
import type { BlockData } from '../../types.js';
import { nn } from '../../utils/notNull.js';

/**
 * Структура output блока: stdout/stderr/result для текстового вывода,
 * outputs для бинарных вложений (PNG/JPEG из matplotlib и т.п.).
 */
interface CodeCellOutput {
    /** Строки stdout, обычно из print() */
    stdout?: string[];
    /** Строки stderr, обычно из traceback */
    stderr?: string[];
    /** Возвращаемое значение последнего expression в ячейке */
    result?: string;
    /** Текст ошибки выполнения (отдельно от stderr) */
    error?: string;
    /** Бинарные выводы (изображения и т.п.) с MIME-типом и base64-данными */
    outputs?: { mime_type: string; data: string }[];
}

/**
 * Опции конструктора CodeCell: данные блока + callback'и на действия пользователя.
 */
export interface CodeCellOptions {
    /** Серверные данные блока (id, content, position) */
    blockData: BlockData;
    /** Если true — ячейка только для чтения: textarea заблокирована, action-кнопки скрыты, обработчики правки не вешаются */
    readonly?: boolean;
    /** Вызывается при клике на "Переместить вверх" */
    onMoveUp?: (id: string) => void;
    /** Вызывается при клике на "Переместить вниз" */
    onMoveDown?: (id: string) => void;
    /** Вызывается при клике на "Копировать" */
    onCopy?: (id: string) => void;
    /** Вызывается при клике на "Удалить" */
    onDelete?: (id: string) => void;
    /** Вызывается при клике на "Запустить" (если cell не в running-состоянии) */
    onRun?: (id: string) => void;
    /** Вызывается при изменении содержимого с debounce 400ms */
    onContentChange?: (id: string, content: string) => void;
}

/**
 * Ячейка с кодом в notebook'е (Jupyter-like). Содержит textarea с подсветкой
 * номеров строк, кнопку Run, output-секцию (stdout/stderr/result/images) и
 * action-кнопки (move/copy/delete). Поддерживает Tab→4 пробела, авто-resize
 * под содержимое, дебаунс уведомлений об изменениях для снижения нагрузки на API.
 */
export class CodeCell extends BaseComponent {
    #blockData: BlockData;
    #readonly: boolean;
    #onMoveUp?: (id: string) => void;
    #onMoveDown?: (id: string) => void;
    #onCopy?: (id: string) => void;
    #onDelete?: (id: string) => void;
    #onRun?: (id: string) => void;
    #isRunning = false;
    #onContentChange: ((id: string, content: string) => void) | null = null;
    #contentChangeTimer: ReturnType<typeof setTimeout> | null = null;

    static #CONTENT_DEBOUNCE_MS = 400;

    /**
     * Создаёт ячейку с заданными данными блока и набором обработчиков действий.
     * @param parent - родительский элемент
     * @param options - данные блока и callback'и (см. CodeCellOptions)
     */
    public constructor(
        parent: HTMLElement,
        {
            blockData,
            readonly,
            onMoveUp,
            onMoveDown,
            onCopy,
            onDelete,
            onRun,
            onContentChange
        }: CodeCellOptions
    ) {
        super(null, parent);
        this.#blockData = blockData;
        this.#readonly = readonly ?? false;
        this.#onMoveUp = onMoveUp;
        this.#onMoveDown = onMoveDown;
        this.#onCopy = onCopy;
        this.#onDelete = onDelete;
        this.#onRun = onRun;
        this.#onContentChange = onContentChange ?? null;
        this.#render();
    }

    /**
     * Рендерит шаблон в detached-контейнер; в DOM попадает при mount().
     */
    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = CodeCellTemplate({
            id: this.#blockData.id,
            content: this.#blockData.content || '',
            readonly: this.#readonly
        });
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    /**
     * Маунтит ячейку, отрисовывает номера строк, подгоняет высоту textarea
     * под содержимое и навешивает обработчики.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#updateLineNumbers();
        this.#autoResize();
        this.#attachEvents();
    }

    /**
     * Снимает с DOM, отменяет ожидающий debounce-таймер чтобы не дёрнуть
     * onContentChange после размонтирования.
     */
    public unmount(): void {
        if (this.#contentChangeTimer !== null) {
            clearTimeout(this.#contentChangeTimer);
            this.#contentChangeTimer = null;
        }
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Перезапускает debounce-таймер уведомления об изменении содержимого.
     * Реальный onContentChange вызовется только если в течение CONTENT_DEBOUNCE_MS
     * не было новых правок — снижает нагрузку на API при наборе.
     */
    #scheduleContentChange(): void {
        if (!this.#onContentChange) return;
        if (this.#contentChangeTimer !== null) clearTimeout(this.#contentChangeTimer);
        this.#contentChangeTimer = setTimeout(() => {
            this.#contentChangeTimer = null;
            nn(this.#onContentChange)(this.#blockData.id, this.getContent());
        }, CodeCell.#CONTENT_DEBOUNCE_MS);
    }

    /**
     * Принудительно отменяет ожидающий debounce-таймер БЕЗ вызова callback'а.
     * Используется при ручном save (Ctrl+S) — чтобы не отправлять второй запрос.
     */
    public flushContentChange(): void {
        if (this.#contentChangeTimer === null) return;
        clearTimeout(this.#contentChangeTimer);
        this.#contentChangeTimer = null;
    }

    /**
     * Навешивает обработчики: input для авто-resize и debounce, keydown для
     * Tab→4 пробела, click для Run и action-кнопок.
     */
    #attachEvents(): void {
        const textarea = nn(
            this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea')
        );

        if (!this.#readonly) {
            this._addListener(textarea, 'input', () => {
                this.#updateLineNumbers();
                this.#autoResize();
                this.#scheduleContentChange();
            });

            this._addListener(textarea, 'keydown', (e: unknown) => {
                if ((e as KeyboardEvent).key === 'Tab') {
                    (e as KeyboardEvent).preventDefault();
                    const ta = textarea;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    ta.value = `${ta.value.substring(0, start)}    ${ta.value.substring(end)}`;
                    ta.selectionStart = start + 4;
                    ta.selectionEnd = start + 4;
                    this.#updateLineNumbers();
                }
            });

            this._element.querySelectorAll('.code-cell__action-btn').forEach((btn) => {
                const action = (btn as HTMLElement).dataset.action;
                this._addListener(btn, 'click', () => {
                    if (action === 'move-up' && this.#onMoveUp) this.#onMoveUp(this.#blockData.id);
                    if (action === 'move-down' && this.#onMoveDown)
                        this.#onMoveDown(this.#blockData.id);
                    if (action === 'copy' && this.#onCopy) this.#onCopy(this.#blockData.id);
                    if (action === 'delete' && this.#onDelete) this.#onDelete(this.#blockData.id);
                });
            });
        }

        if (!this.#readonly) {
            const runBtn = this._element.querySelector('.code-cell__run-btn');
            this._addListener(runBtn, 'click', () => {
                if (this.#onRun && !this.#isRunning) this.#onRun(this.#blockData.id);
            });
        }
    }

    /**
     * Перерисовывает колонку с номерами строк по содержимому textarea.
     */
    #updateLineNumbers(): void {
        const textarea = nn(
            this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea')
        );
        const lineNumbers = nn(this._element.querySelector('.code-cell__line-numbers'));
        const lines = textarea.value.split('\n');
        lineNumbers.innerHTML = lines
            .map((_: string, i: number) => `<div>${String(i + 1)}</div>`)
            .join('');
    }

    /**
     * Подгоняет высоту textarea под содержимое (минимум — высота родительского
     * редактора). Вызывается при каждом input.
     */
    #autoResize(): void {
        const textarea = nn(
            this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea')
        );
        textarea.style.height = 'auto';
        const scrollH = textarea.scrollHeight;
        const editorH = nn(
            this._element.querySelector<HTMLElement>('.code-cell__editor')
        ).clientHeight;
        textarea.style.height = `${String(Math.max(scrollH, editorH))}px`;
    }

    /**
     * Возвращает текущий код из textarea.
     * @returns строка содержимого
     */
    public getContent(): string {
        return nn(this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea')).value;
    }

    /**
     * Устанавливает содержимое textarea и перерисовывает номера строк/высоту.
     * Используется при undo/синхронизации с сервером.
     * @param text - новое содержимое
     */
    public setContent(text: string): void {
        const textarea = nn(
            this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea')
        );
        textarea.value = text;
        this.#updateLineNumbers();
        this.#autoResize();
    }

    /**
     * Подсвечивает диапазон символов в textarea и скроллит к ячейке.
     * Используется в find-in-notebook (поиск по тексту).
     * @param start - индекс начала диапазона
     * @param end - индекс конца диапазона
     */
    public highlightRange(start: number, end: number): void {
        const textarea = nn(
            this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea')
        );
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start, end);
        this._element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Возвращает идентификатор связанного с ячейкой блока в notebook'е.
     * @returns ID блока (UUID-строка)
     */
    public getBlockId(): string {
        return this.#blockData.id;
    }

    /**
     * Помечает ячейку как выполняющуюся: добавляет CSS-класс (для спиннера)
     * и очищает предыдущий output. При false — снимает класс.
     * @param isRunning - идёт ли сейчас выполнение
     */
    public setRunning(isRunning: boolean): void {
        this.#isRunning = isRunning;
        this._element.classList.toggle('code-cell--running', isRunning);
        if (isRunning) this.clearOutput();
    }

    /**
     * Обновляет номер выполнения [N] слева от ячейки. null показывает [ ].
     * Аналог Jupyter execution count.
     * @param n - номер выполнения или null
     */
    public setExecutionNumber(n: number | null): void {
        const el = this._element.querySelector('.code-cell__execution-number');
        if (el) el.textContent = `[${String(n ?? ' ')}]`;
    }

    /**
     * Заполняет output-секцию: stdout/stderr через ansiToHtml (для цветов),
     * result как текст, изображения как <img> с base64-data-URL.
     * Скрывает секцию если выводов нет, добавляет класс error при stderr.
     * @param out - данные output (см. CodeCellOutput)
     */
    // eslint-disable-next-line complexity -- TODO(refactor): split per-output-type renderers into #renderStdout/#renderStderr/#renderResult/#renderImages; pre-existing tech debt
    public setOutput(out: CodeCellOutput = {}): void {
        const el = nn(this._element.querySelector('.code-cell__output'));
        const stdoutEl = nn(el.querySelector('.code-cell__output-stdout'));
        const stderrEl = nn(el.querySelector('.code-cell__output-stderr'));
        const resultEl = nn(el.querySelector('.code-cell__output-result'));
        const imagesEl = nn(el.querySelector('.code-cell__output-images'));

        const imageOutputs = (out.outputs ?? []).filter(
            (o) => o.mime_type === 'image/png' || o.mime_type === 'image/jpeg'
        );

        const hasAny =
            (out.stdout?.length ?? 0) > 0 ||
            (out.stderr?.length ?? 0) > 0 ||
            Boolean(out.result) ||
            Boolean(out.error) ||
            imageOutputs.length > 0;

        (el as HTMLElement).hidden = !hasAny;

        const stdoutText = (out.stdout?.length ?? 0) !== 0 ? out.stdout.join('\n') : '';
        stdoutEl.innerHTML = stdoutText ? ansiToHtml(handleCarriageReturns(stdoutText)) : '';

        const stderrText = [out.stderr?.join('\n') ?? '', out.error ?? '']
            .filter(Boolean)
            .join('\n');
        stderrEl.innerHTML = stderrText
            ? ansiToHtml(handleCarriageReturns(stripTracebackDashes(stderrText)))
            : '';

        resultEl.textContent = imageOutputs.length ? '' : (out.result ?? '');

        imagesEl.innerHTML = '';
        for (const output of imageOutputs) {
            const img = document.createElement('img');
            img.src = `data:${output.mime_type};base64,${output.data}`;
            img.className = 'code-cell__output-image';
            imagesEl.appendChild(img);
        }

        this._element.classList.toggle(
            'code-cell--error',
            Boolean(out.stderr?.length ?? out.error)
        );
    }

    /**
     * Очищает все секции output и снимает error-класс. Вызывается перед каждым
     * новым запуском кода.
     */
    public clearOutput(): void {
        const el = this._element.querySelector('.code-cell__output');
        if (!el) return;
        (el as HTMLElement).hidden = true;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        el.querySelector('.code-cell__output-stdout')!.innerHTML = '';
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        el.querySelector('.code-cell__output-stderr')!.innerHTML = '';
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        el.querySelector('.code-cell__output-result')!.textContent = '';
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        el.querySelector('.code-cell__output-images')!.innerHTML = '';
        this._element.classList.remove('code-cell--error');
    }
}
