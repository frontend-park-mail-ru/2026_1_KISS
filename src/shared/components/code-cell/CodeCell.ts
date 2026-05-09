import { BaseComponent } from '../base-component/BaseComponent.js';
import { CodeCellTemplate } from './CodeCell.template.js';
import { ansiToHtml, stripTracebackDashes, handleCarriageReturns } from '../../utils/ansiToHtml.js';
import type { BlockData } from '../../types.js';
import { nn } from '../../utils/notNull.js';

interface CodeCellOutput {
    stdout?: string[];
    stderr?: string[];
    result?: string;
    error?: string;
    outputs?: { mime_type: string; data: string }[];
}

export interface CodeCellOptions {
    blockData: BlockData;
    onMoveUp?: (id: string) => void;
    onMoveDown?: (id: string) => void;
    onCopy?: (id: string) => void;
    onDelete?: (id: string) => void;
    onRun?: (id: string) => void;
    onContentChange?: (id: string, content: string) => void;
}

export class CodeCell extends BaseComponent {
    #blockData: BlockData;
    #onMoveUp?: (id: string) => void;
    #onMoveDown?: (id: string) => void;
    #onCopy?: (id: string) => void;
    #onDelete?: (id: string) => void;
    #onRun?: (id: string) => void;
    #isRunning = false;
    #onContentChange: ((id: string, content: string) => void) | null = null;
    #contentChangeTimer: ReturnType<typeof setTimeout> | null = null;

    static #CONTENT_DEBOUNCE_MS = 400;

    public constructor(
        parent: HTMLElement,
        {
            blockData,
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
        this.#onMoveUp = onMoveUp;
        this.#onMoveDown = onMoveDown;
        this.#onCopy = onCopy;
        this.#onDelete = onDelete;
        this.#onRun = onRun;
        this.#onContentChange = onContentChange ?? null;
        this.#render();
    }

    #render(): void {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = CodeCellTemplate({
            id: this.#blockData.id,
            content: this.#blockData.content || ''
        });
        this._element = tempContainer.firstElementChild as HTMLElement;
    }

    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this.#updateLineNumbers();
        this.#autoResize();
        this.#attachEvents();
    }

    public unmount(): void {
        if (this.#contentChangeTimer) {
            clearTimeout(this.#contentChangeTimer);
            this.#contentChangeTimer = null;
        }
        if (!this._isMounted) return;
        super.unmount();
    }

    #scheduleContentChange(): void {
        if (!this.#onContentChange) return;
        if (this.#contentChangeTimer) clearTimeout(this.#contentChangeTimer);
        this.#contentChangeTimer = setTimeout(() => {
            this.#contentChangeTimer = null;
            nn(this.#onContentChange)(this.#blockData.id, this.getContent());
        }, CodeCell.#CONTENT_DEBOUNCE_MS);
    }

    public flushContentChange(): void {
        if (!this.#contentChangeTimer) return;
        clearTimeout(this.#contentChangeTimer);
        this.#contentChangeTimer = null;
    }

    #attachEvents(): void {
        const textarea = nn(this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea'));

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

        const runBtn = this._element.querySelector('.code-cell__run-btn');
        this._addListener(runBtn, 'click', () => {
            if (this.#onRun && !this.#isRunning) this.#onRun(this.#blockData.id);
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

    #updateLineNumbers(): void {
        const textarea = nn(
            this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea')
        );
        const lineNumbers = nn(this._element.querySelector('.code-cell__line-numbers'));
        const lines = textarea.value.split('\n');
        lineNumbers.innerHTML = lines.map((_: string, i: number) => `<div>${String(i + 1)}</div>`).join('');
    }

    #autoResize(): void {
        const textarea = nn(this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea'));
        textarea.style.height = 'auto';
        const scrollH = textarea.scrollHeight;
        const editorH = nn(this._element.querySelector<HTMLElement>('.code-cell__editor')).clientHeight;
        textarea.style.height = `${String(Math.max(scrollH, editorH))}px`;
    }

    public getContent(): string {
        return nn(this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea')).value;
    }

    public setContent(text: string): void {
        const textarea = nn(this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea'));
        textarea.value = text;
        this.#updateLineNumbers();
        this.#autoResize();
    }

    public highlightRange(start: number, end: number): void {
        const textarea = nn(this._element.querySelector<HTMLTextAreaElement>('.code-cell__textarea'));
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start, end);
        this._element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    public getBlockId(): string {
        return this.#blockData.id;
    }

    public setRunning(isRunning: boolean): void {
        this.#isRunning = isRunning;
        this._element.classList.toggle('code-cell--running', isRunning);
        if (isRunning) this.clearOutput();
    }

    public setExecutionNumber(n: number | null): void {
        const el = this._element.querySelector('.code-cell__execution-number');
        if (el) el.textContent = `[${String(n ?? ' ')}]`;
    }

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

        const stdoutText = out.stdout?.length ? out.stdout.join('\n') : '';
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
