import type { ImportBlockInput } from '../../api/NotebookApi.js';

/**
 * Минимальное описание ячейки для экспорта в .ipynb. Создаётся в page-слое
 * на основании `CodeCell`/`TextCell` (instanceof проверяется снаружи), чтобы
 * чистая функция nbformat-преобразования не зависела от UI-классов.
 */
export interface ExportCell {
    /** ID блока на сервере (источник для поиска outputs в Map) */
    blockId: number | string;
    /** Текущее содержимое ячейки (исходный код или markdown) */
    content: string;
    /** true для code-ячейки, false для text/markdown */
    isCode: boolean;
}

/**
 * nbformat-4 документ, который сохраняется как .ipynb. Структура соответствует
 * Jupyter Notebook Format Specification (без metadata-полей, специфичных для
 * виджетов или slideshow).
 */
export interface IpynbDocument {
    /** Major-версия nbformat (всегда 4) */
    nbformat: number;
    /** Minor-версия nbformat (5) */
    nbformat_minor: number;
    /** Глобальные metadata: kernelspec и language_info */
    metadata: Record<string, unknown>;
    /** Массив ячеек в формате nbformat */
    cells: Record<string, unknown>[];
}

/**
 * Структура одного output'а в KISS-формате (как хранится в Map'е #lastOutputs
 * на странице). Поля опциональны, потому что не каждый код производит каждый
 * тип вывода.
 */
export interface CellOutput {
    /** Строки stdout (без терминальных \n) */
    stdout?: string[];
    /** Строки stderr (без терминальных \n) */
    stderr?: string[];
    /** Возвращённое значение последнего expression'а (REPL-style) */
    result?: string;
    /** Текст ошибки выполнения (отдельно от stderr, для показа в UI) */
    error?: string;
    /** Бинарные outputs: изображения, графики (base64-encoded) */
    outputs?: { mime_type: string; data: string }[];
}

const STREAM_NEWLINE = (s: string): string => `${s}\n`;

/**
 * Преобразует строку в массив строк с сохранёнными \n (как ожидает nbformat
 * для cell.source). Пустая строка → пустой массив, иначе строки разбиваются
 * по \n с возвращением \n в конец каждой строки кроме последней.
 * @param content - исходное содержимое ячейки
 * @returns массив строк формата nbformat
 */
function contentToSource(content: string): string[] {
    if (content === '') return [];
    return content.split('\n').map((l, i, a) => (i < a.length - 1 ? STREAM_NEWLINE(l) : l));
}

/**
 * Строит массив outputs одной code-ячейки в формате nbformat из
 * KISS-формата (CellOutput) — stdout/stderr → stream, result → execute_result,
 * binary outputs → display_data.
 * @param out - сохранённый output блока
 * @returns массив nbformat-output-объектов
 */
function buildIpynbOutputs(out: CellOutput): Record<string, unknown>[] {
    const outputs: Record<string, unknown>[] = [];
    if (out.stdout !== undefined && out.stdout.length > 0) {
        outputs.push({
            output_type: 'stream',
            name: 'stdout',
            text: out.stdout.map(STREAM_NEWLINE)
        });
    }
    if (out.stderr !== undefined && out.stderr.length > 0) {
        outputs.push({
            output_type: 'stream',
            name: 'stderr',
            text: out.stderr.map(STREAM_NEWLINE)
        });
    }
    if (out.result !== undefined) {
        outputs.push({
            output_type: 'execute_result',
            execution_count: null,
            data: { 'text/plain': [out.result] },
            metadata: {}
        });
    }
    if (out.outputs !== undefined) {
        for (const o of out.outputs) {
            outputs.push({
                output_type: 'display_data',
                data: { [o.mime_type]: o.data },
                metadata: {}
            });
        }
    }
    return outputs;
}

/**
 * Собирает .ipynb-документ из набора ячеек и сохранённых outputs.
 * Чистая функция — без побочных эффектов и DOM-операций. Вызывающий
 * код сам формирует Blob и инициирует скачивание.
 * @param cells - набор ячеек страницы (сериализованный)
 * @param outputs - Map с сохранёнными outputs по blockId (KISS-формат)
 * @returns nbformat-4 документ
 */
export function cellsToIpynb(
    cells: ExportCell[],
    outputs: Map<number | string, CellOutput>
): IpynbDocument {
    const ipynbCells = cells.map((cell) => {
        const source = contentToSource(cell.content);
        if (!cell.isCode) {
            return { cell_type: 'markdown', metadata: {}, source };
        }
        const out = outputs.get(cell.blockId);
        return {
            cell_type: 'code',
            execution_count: null,
            metadata: {},
            source,
            outputs: out ? buildIpynbOutputs(out) : []
        };
    });

    return {
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
}

/**
 * Преобразует один nbformat-output в массив наших ImportBlockInput.outputs
 * (один nbformat-output может развернуться в несколько KISS-outputs, например
 * display_data с двумя MIME-типами → два отдельных output'а).
 * @param o - один output из nbformat
 * @param startPos - текущая позиция счётчика, с которой начинается новый блок
 * @returns массив сконвертированных outputs (может быть пустым для unknown типов)
 */
function nbformatOutputToImport(
    o: Record<string, unknown>,
    startPos: number
): ImportBlockInput['outputs'] {
    const result: ImportBlockInput['outputs'] = [];
    let pos = startPos;

    if (o.output_type === 'stream') {
        const t = Array.isArray(o.text)
            ? (o.text as string[]).join('')
            : ((o.text as string | undefined) ?? '');
        result.push({
            output_type: (o.name as string | undefined) ?? 'stdout',
            content: t,
            position: pos
        });
        return result;
    }

    if (o.output_type === 'execute_result' || o.output_type === 'display_data') {
        if (o.data !== undefined && o.data !== null) {
            for (const [mime, val] of Object.entries(o.data as Record<string, unknown>)) {
                const c = Array.isArray(val) ? (val as string[]).join('') : String(val);
                result.push({
                    output_type: mime === 'text/plain' ? 'result' : mime,
                    content: c,
                    position: pos++
                });
            }
        }
        return result;
    }

    if (o.output_type === 'error') {
        const tb = ((o.traceback ?? []) as string[]).join('\n');
        result.push({
            output_type: 'stderr',
            content: tb,
            position: pos
        });
        return result;
    }

    return result;
}

/**
 * Парсит .ipynb-документ (как Record<string, unknown>) и возвращает массив
 * блоков в формате, который ожидает NotebookApi.importNotebook. Поддерживает
 * code- и markdown-ячейки; для code-блоков сохраняет outputs (stream/result/
 * display_data/error). Чистая функция — без сетевых запросов.
 * @param ipynb - распарсенный JSON .ipynb-файла
 * @returns массив блоков для отправки на /notebooks/import
 */
export function ipynbToBlocks(ipynb: { cells?: Record<string, unknown>[] }): ImportBlockInput[] {
    const cells = ipynb.cells ?? [];
    return cells.map((cell, i) => {
        const content = Array.isArray(cell.source)
            ? (cell.source as string[]).join('')
            : ((cell.source as string | undefined) ?? '');
        const type = cell.cell_type === 'code' ? 'code' : 'text';
        const language = type === 'code' ? 'python' : 'markdown';
        const outputs: ImportBlockInput['outputs'] = [];

        if (type === 'code' && Array.isArray(cell.outputs)) {
            let pos = 0;
            for (const o of cell.outputs as Record<string, unknown>[]) {
                const converted = nbformatOutputToImport(o, pos);
                outputs.push(...converted);
                pos += converted.length;
            }
        }

        return { type, language, content, position: i, outputs };
    });
}
