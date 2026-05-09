/**
 * Описание одной "ячейки" для поиска (упрощённая версия BlockData без зависимостей).
 */
interface CellInput {
    /** ID блока */
    id: number | string;
    /** Тип блока — для разной обработки в highlightMatch */
    kind: 'code' | 'text';
    /** Содержимое для поиска */
    content: string;
}

/**
 * Одно найденное совпадение: где лежит и какой диапазон занимает.
 */
interface MatchEntry {
    /** ID блока */
    blockId: number | string;
    /** Тип блока */
    kind: 'code' | 'text';
    /** Начальная позиция в content */
    start: number;
    /** Конечная позиция в content */
    end: number;
}

/**
 * Совпадение с индексом для UI ("3 из 12").
 */
interface MatchResult extends MatchEntry {
    /** Порядковый номер в массиве matches (0-based) */
    index: number;
}

/**
 * Движок поиска по содержимому блоков notebook'а с поддержкой next/prev навигации.
 * Используется в виджете find-bar (Ctrl+F) на странице блоков.
 *
 * Не использует regex — простой indexOf для производительности на больших notebook'ах.
 * Циклическая навигация: после последнего → первый, перед первым → последний.
 */
export class FindEngine {
    #matches: MatchEntry[] = [];
    #currentIdx = -1;

    /**
     * Выполняет поиск query во всех ячейках. Заменяет внутреннее состояние
     * на новые matches; устанавливает currentIdx на первое совпадение (или -1).
     * @param cells - массив ячеек для поиска
     * @param query - искомая подстрока (пустая = очистка)
     * @param caseSensitive - учитывать регистр
     * @returns общее количество найденных совпадений
     */
    public search(cells: CellInput[], query: string, caseSensitive: boolean): number {
        this.#matches = [];
        this.#currentIdx = -1;
        if (!query) return 0;

        for (const cell of cells) {
            const haystack = caseSensitive ? cell.content : cell.content.toLowerCase();
            const needle = caseSensitive ? query : query.toLowerCase();
            let idx = 0;
            while ((idx = haystack.indexOf(needle, idx)) !== -1) {
                this.#matches.push({
                    blockId: cell.id,
                    kind: cell.kind,
                    start: idx,
                    end: idx + query.length
                });
                idx += query.length || 1;
            }
        }
        if (this.#matches.length > 0) this.#currentIdx = 0;
        return this.#matches.length;
    }

    /**
     * Переходит к следующему совпадению (циклически). Возвращает текущее
     * совпадение для UI, чтобы он мог проскроллить и подсветить.
     * @returns следующее совпадение или null если поиск пустой
     */
    public next(): MatchResult | null {
        if (this.#matches.length === 0) return null;
        this.#currentIdx = (this.#currentIdx + 1) % this.#matches.length;
        return this.current();
    }

    /**
     * Переходит к предыдущему совпадению (циклически).
     * @returns предыдущее совпадение или null если поиск пустой
     */
    public prev(): MatchResult | null {
        if (this.#matches.length === 0) return null;
        this.#currentIdx = (this.#currentIdx - 1 + this.#matches.length) % this.#matches.length;
        return this.current();
    }

    /**
     * Возвращает текущее активное совпадение (без сдвига индекса).
     * @returns текущее совпадение с индексом или null
     */
    public current(): MatchResult | null {
        if (this.#currentIdx < 0) return null;
        return { ...this.#matches[this.#currentIdx], index: this.#currentIdx };
    }

    /**
     * Общее количество найденных совпадений (для UI "X из N").
     * @returns число совпадений
     */
    public total(): number {
        return this.#matches.length;
    }

    /**
     * Текущий индекс совпадения (0-based, или -1 если совпадений нет).
     * @returns индекс или -1
     */
    public index(): number {
        return this.#currentIdx;
    }

    /**
     * Сбрасывает состояние поиска (вызывается при закрытии find-bar или
     * существенных изменениях notebook'а).
     */
    public reset(): void {
        this.#matches = [];
        this.#currentIdx = -1;
    }
}
