import { CodeCell } from '../../shared/components/code-cell/CodeCell.js';
import type { ExecutionState } from '../../shared/domain/notebook/ExecutionState.js';
import type { StreamBuffer } from '../../shared/domain/streaming/StreamBuffer.js';
import type { CellList } from '../../widgets/cell-list/CellList.js';
import type { BlockData } from '../../shared/types.js';

/**
 * Зависимости WS-обработчика. Передаются единым объектом, потому что хендлеру
 * нужно одновременно: знать состояние стриминга (буфер), execution-состояние,
 * актуальный CellList (через геттер, потому что он создаётся позже страницы)
 * и колбэки на завершение/resync.
 */
export interface WsHandlerDeps {
    /** Буфер стриминга stdout/stderr (см. StreamBuffer) */
    streamBuffer: StreamBuffer;
    /** Состояние исполнения (счётчики, outputs) */
    execState: ExecutionState;
    /** Геттер актуального CellList (может быть null до build'а layout'а) */
    getCellList: () => CellList | null;
    /** Колбэк при завершении одного стрима — резолвит ожидающий промис в page */
    onStreamComplete: () => void;
    /** Колбэк при notebook_updated — обычно вызывает resync с сервера */
    onResync: () => void;
}

/**
 * Обрабатывает события block_added/block_updated/block_deleted и комментариев,
 * перенаправляя их в CellList.applyRemoteEvent для синхронизации UI с другими
 * клиентами.
 * @param event - WS-событие изменения структуры notebook'а
 * @param cellList - актуальный CellList (если null — событие игнорируется)
 */
function handleStructuralEvent(event: Record<string, unknown>, cellList: CellList | null): void {
    if (!cellList) return;
    cellList.applyRemoteEvent(
        event as { type: string; block?: BlockData; block_id?: string | number }
    );
}

/**
 * Обрабатывает событие ошибки выполнения (error / execute_error). Показывает
 * сообщение в активной ячейке, останавливает стриминг и резолвит ожидающий
 * промис.
 * @param event - WS-событие ошибки
 * @param deps - зависимости хендлера
 */
function handleErrorEvent(event: Record<string, unknown>, deps: WsHandlerDeps): void {
    const activeId = deps.streamBuffer.activeBlockId();
    if (activeId === null) return;
    const cell = deps.getCellList()?.getCellByBlockId(activeId);
    if (cell instanceof CodeCell) {
        cell.setOutput({
            error: typeof event.message === 'string' ? event.message : 'execution error'
        });
        cell.setRunning(false);
    }
    deps.streamBuffer.stop();
    deps.onStreamComplete();
}

/**
 * Обрабатывает финальное событие execute_completed: применяет результат
 * (приоритет — данным из event.block, fallback на буфер стриминга),
 * присваивает execution-номер, останавливает буфер и резолвит промис.
 * @param event - WS-событие завершения исполнения
 * @param deps - зависимости хендлера
 */
function handleExecuteCompleted(event: Record<string, unknown>, deps: WsHandlerDeps): void {
    const activeId = deps.streamBuffer.activeBlockId();
    if (activeId === null) return;
    const cell = deps.getCellList()?.getCellByBlockId(activeId);
    const result = (event.block ?? {}) as Record<string, unknown>;
    if (cell instanceof CodeCell) {
        const execNum = deps.execState.assignNextNumber(activeId);
        const output = {
            stdout: (result.stdout as string[] | undefined) ?? deps.streamBuffer.stdout(),
            stderr: (result.stderr as string[] | undefined) ?? deps.streamBuffer.stderr(),
            result: result.result as string
        };
        deps.execState.setOutput(activeId, output);
        cell.setExecutionNumber(execNum);
        cell.setOutput(output);
        cell.setRunning(false);
    }
    deps.streamBuffer.stop();
    deps.onStreamComplete();
}

/**
 * Главный switch-диспетчер по типам WS-событий (за вычетом error/execute_error
 * — те обрабатываются отдельно). Вынесен из создаваемого хендлера, чтобы
 * самой функции-обёртке хватало complexity ≤ 15.
 * @param event - WS-событие с обязательным полем type
 * @param deps - зависимости хендлера
 */
function dispatchSwitch(event: Record<string, unknown>, deps: WsHandlerDeps): void {
    switch (event.type) {
        case 'block_added':
        case 'block_updated':
        case 'block_deleted':
        case 'comment_added':
        case 'comment_deleted':
            handleStructuralEvent(event, deps.getCellList());
            break;
        case 'notebook_updated':
            deps.onResync();
            break;
        case 'stdout_chunk':
            deps.streamBuffer.appendStdout(typeof event.message === 'string' ? event.message : '');
            break;
        case 'stderr_chunk':
            deps.streamBuffer.appendStderr(typeof event.message === 'string' ? event.message : '');
            break;
        case 'execute_completed':
            handleExecuteCompleted(event, deps);
            break;
        default:
            break;
    }
}

/**
 * Создаёт хендлер WS-событий для NotebookWS.onEvent. Возвращаемая функция
 * диспатчит 9 типов событий: error/execute_error, block_added/updated/deleted,
 * comment_added/deleted, notebook_updated, stdout_chunk, stderr_chunk и
 * execute_completed.
 * @param deps - зависимости (см. WsHandlerDeps)
 * @returns функция-хендлер для NotebookWS.onEvent
 */
export function createWsHandler(deps: WsHandlerDeps): (event: Record<string, unknown>) => void {
    return (event: Record<string, unknown>): void => {
        if (typeof event.type !== 'string' || event.type === '') return;
        if (event.type === 'error' || event.type === 'execute_error') {
            handleErrorEvent(event, deps);
            return;
        }
        dispatchSwitch(event, deps);
    };
}
