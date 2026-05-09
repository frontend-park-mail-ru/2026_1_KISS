/**
 * Колбэк, вызываемый StreamBuffer'ом при throttle-flush'е. Получает текущий
 * активный блок и накопленные строки stdout/stderr — пользователь рендерит
 * их в свою UI-ячейку.
 */
export type StreamFlushCallback = (
    blockId: number | string,
    stdout: string[],
    stderr: string[]
) => void;

/**
 * Опции конструктора StreamBuffer.
 */
export interface StreamBufferOptions {
    /** Колбэк, вызываемый при throttle-flush'е (обычно — обновление DOM ячейки) */
    onFlush: StreamFlushCallback;
    /** Интервал throttle'а в миллисекундах (по умолчанию 200) */
    throttleMs?: number;
    /** Максимум строк в буфере stdout/stderr (по умолчанию 1000) */
    maxLines?: number;
}

const DEFAULT_THROTTLE_MS = 200;
const DEFAULT_MAX_LINES = 1000;

/**
 * Буфер стриминга stdout/stderr с throttle-рендером. Защищает UI от
 * рендер-шторма при быстром потоке вывода (например `for i in range(10000):
 * print(i)`): чанки накапливаются и сбрасываются через onFlush не чаще
 * чем раз в throttleMs.
 *
 * Инкапсулирует «активный блок» (один за раз — соответствует одному запуску
 * через WebSocket). При превышении maxLines старые строки отбрасываются с
 * головы массива, чтобы не утечь памятью.
 *
 * Жизненный цикл: start(blockId) → appendStdout/appendStderr → stop().
 */
export class StreamBuffer {
    #blockId: number | string | null = null;
    #stdout: string[] = [];
    #stderr: string[] = [];
    #renderPending = false;
    readonly #throttleMs: number;
    readonly #maxLines: number;
    readonly #onFlush: StreamFlushCallback;

    /**
     * Сохраняет настройки и колбэк. Сам по себе буфер ничего не делает,
     * пока не будет вызван start().
     * @param opts - параметры буфера (см. StreamBufferOptions)
     */
    public constructor(opts: StreamBufferOptions) {
        this.#onFlush = opts.onFlush;
        this.#throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS;
        this.#maxLines = opts.maxLines ?? DEFAULT_MAX_LINES;
    }

    /**
     * Начинает стриминг для указанного блока: запоминает активный блок и
     * сбрасывает буферы stdout/stderr.
     * @param blockId - ID блока, для которого начинается выполнение
     */
    public start(blockId: number | string): void {
        this.#blockId = blockId;
        this.#stdout = [];
        this.#stderr = [];
    }

    /**
     * Завершает стриминг (например, после execute_completed). После stop()
     * appendStdout/appendStderr игнорируются до следующего start().
     */
    public stop(): void {
        this.#blockId = null;
    }

    /**
     * Возвращает текущий активный блок или null если стриминг не идёт.
     * @returns blockId или null
     */
    public activeBlockId(): number | string | null {
        return this.#blockId;
    }

    /**
     * Текущее содержимое stdout-буфера (без копии — не мутируйте снаружи).
     * @returns массив строк stdout
     */
    public stdout(): string[] {
        return this.#stdout;
    }

    /**
     * Текущее содержимое stderr-буфера.
     * @returns массив строк stderr
     */
    public stderr(): string[] {
        return this.#stderr;
    }

    /**
     * Добавляет одну строку в stdout-буфер активного блока. При переполнении
     * (> maxLines) старые строки выбрасываются. Планирует throttle-flush.
     * Если активного блока нет — no-op.
     * @param line - строка stdout
     */
    public appendStdout(line: string): void {
        if (this.#blockId === null) return;
        this.#stdout.push(line);
        if (this.#stdout.length > this.#maxLines) {
            this.#stdout = this.#stdout.slice(-this.#maxLines);
        }
        this.#scheduleFlush();
    }

    /**
     * Добавляет одну строку в stderr-буфер активного блока. См. appendStdout.
     * @param line - строка stderr
     */
    public appendStderr(line: string): void {
        if (this.#blockId === null) return;
        this.#stderr.push(line);
        if (this.#stderr.length > this.#maxLines) {
            this.#stderr = this.#stderr.slice(-this.#maxLines);
        }
        this.#scheduleFlush();
    }

    /**
     * Планирует throttle-flush: первый append после flush'а ставит таймер
     * на throttleMs, последующие чанки в этом окне просто накапливаются.
     */
    #scheduleFlush(): void {
        if (this.#renderPending) return;
        this.#renderPending = true;
        setTimeout(() => {
            this.#renderPending = false;
            if (this.#blockId === null) return;
            this.#onFlush(this.#blockId, this.#stdout, this.#stderr);
        }, this.#throttleMs);
    }
}
