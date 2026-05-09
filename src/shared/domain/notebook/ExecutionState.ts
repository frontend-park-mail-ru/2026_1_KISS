import type { CellOutput } from './nbformat.js';

/**
 * Преобразует ответ Runner-сервиса (результат executeBlock/executeFromPosition)
 * в CellOutput. Чистая функция — без побочных эффектов и DOM-операций.
 *
 * Поддерживает два формата входа: успешный результат с `stdout`/`stderr`/`result`/
 * `outputs` или ошибку с `error`. Не различает их сама — вызывающий код должен
 * проверить наличие `error` отдельно (потому что error может прийти вместе с
 * успешным stdout, например при partial-output до краша).
 * @param r - сырой результат от RunnerApi
 * @returns CellOutput, готовый к setOutput на ячейку или сохранению
 */
export function runnerResultToCellOutput(r: Record<string, unknown>): CellOutput {
    if (r.error !== undefined && r.error !== null && r.error !== '') {
        return { error: r.error as string };
    }
    return {
        stdout: r.stdout as string[] | undefined,
        stderr: r.stderr as string[] | undefined,
        result: r.result as string | undefined,
        outputs: r.outputs as { mime_type: string; data: string }[] | undefined
    };
}

/**
 * Хранит execution-состояние notebook'а: глобальный счётчик исполнений,
 * номера, выданные конкретным блокам (Jupyter-style execution_count), и
 * последние outputs каждого блока.
 *
 * Заменяет три разрозненных поля в BlocksPage (#executionCounter, #execNumbers,
 * #lastOutputs) единым объектом с явным API. Это разделяет «состояние
 * исполнения» (домен) от «как его рисовать в ячейке» (виджет CellList).
 *
 * Ключи — `number | string`, потому что в потоке между WS и REST `block_id`
 * приходит то как число (REST), то как строка (WS).
 */
export class ExecutionState {
    #counter = 0;
    #numbers = new Map<number | string, number>();
    #outputs = new Map<number | string, CellOutput>();

    /**
     * Инкрементирует глобальный счётчик исполнений и присваивает новый
     * номер указанному блоку. Используется при старте выполнения, до
     * получения результата.
     * @param blockId - ID выполняемого блока
     * @returns присвоенный execution-номер (новое значение счётчика)
     */
    public assignNextNumber(blockId: number | string): number {
        this.#counter += 1;
        this.#numbers.set(blockId, this.#counter);
        return this.#counter;
    }

    /**
     * Сохраняет output блока (stdout/stderr/result/outputs/error). Перезаписывает
     * предыдущий output, если был.
     * @param blockId - ID блока
     * @param output - результат исполнения
     */
    public setOutput(blockId: number | string, output: CellOutput): void {
        this.#outputs.set(blockId, output);
    }

    /**
     * Возвращает сохранённый output блока, если есть.
     * @param blockId - ID блока
     * @returns CellOutput или undefined если блок ещё не выполнялся
     */
    public getOutput(blockId: number | string): CellOutput | undefined {
        return this.#outputs.get(blockId);
    }

    /**
     * Проверяет, есть ли сохранённый output для блока.
     * @param blockId - ID блока
     * @returns true если хотя бы один раз был сохранён output
     */
    public hasOutput(blockId: number | string): boolean {
        return this.#outputs.has(blockId);
    }

    /**
     * Удаляет всё состояние блока (номер и output). Вызывается при удалении
     * блока, чтобы не утечь памятью и не показать старый output если позже
     * будет создан блок с тем же id.
     * @param blockId - ID удаляемого блока
     */
    public discard(blockId: number | string): void {
        this.#numbers.delete(blockId);
        this.#outputs.delete(blockId);
    }

    /**
     * Итерация по всем сохранённым execution-номерам. Используется виджетом
     * CellList при перерендере, чтобы вернуть бейджи [n] на ячейки.
     * @param cb - колбэк (number, blockId)
     */
    public forEachNumber(cb: (n: number, blockId: number | string) => void): void {
        this.#numbers.forEach(cb);
    }

    /**
     * Итерация по всем сохранённым outputs. Используется виджетом CellList
     * при перерендере, чтобы вернуть последний результат на ячейки.
     * @param cb - колбэк (CellOutput, blockId)
     */
    public forEachOutput(cb: (out: CellOutput, blockId: number | string) => void): void {
        this.#outputs.forEach(cb);
    }

    /**
     * Возвращает сырую Map outputs для передачи в чистые функции
     * (например cellsToIpynb). Не предназначена для прямой мутации
     * — используйте setOutput / discard.
     * @returns Map blockId → CellOutput
     */
    public outputsMap(): Map<number | string, CellOutput> {
        return this.#outputs;
    }

    /**
     * Заполняет outputs из ответа GET /notebooks/:id (блоки приходят с
     * сохранёнными результатами последнего исполнения). Преобразует
     * серверный формат хранения (`output_type`/`content`) в CellOutput
     * (stdout[]/stderr[]/result/outputs[mime_type/data]).
     *
     * Если для блока уже есть локальные outputs (свежее) — пропускает,
     * чтобы не затереть результаты только что запущенного блока серверной
     * версией.
     * @param blocks - массив блоков из ответа сервера (как Record для совместимости)
     */
    public loadFromServerBlocks(blocks: Record<string, unknown>[]): void {
        for (const block of blocks) {
            const outputs = block.outputs as Record<string, unknown>[] | undefined;
            if (!outputs || outputs.length === 0) continue;
            const blockId = block.id as number | string;
            if (this.hasOutput(blockId)) continue;

            const out: CellOutput = {};
            const binaryOutputs: { mime_type: string; data: string }[] = [];
            for (const o of outputs) {
                if (o.output_type === 'stdout') out.stdout = [o.content as string];
                else if (o.output_type === 'stderr') out.stderr = [o.content as string];
                else if (o.output_type === 'result') out.result = o.content as string;
                else {
                    binaryOutputs.push({
                        mime_type: o.output_type as string,
                        data: o.content as string
                    });
                }
            }
            if (binaryOutputs.length > 0) out.outputs = binaryOutputs;
            this.setOutput(blockId, out);
        }
    }
}
