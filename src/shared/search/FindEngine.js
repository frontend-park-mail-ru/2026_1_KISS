/**
 * Pure-JS логика поиска по коллекции ячеек.
 * Без DOM: получает массив `{id, kind, content}`, возвращает индексы совпадений.
 */
export class FindEngine {
    #matches = [];
    #currentIdx = -1;

    /**
     * Выполнить поиск по всем ячейкам.
     * @param {Array<{id: number|string, kind: 'code'|'text', content: string}>} cells
     * @param {string} query
     * @param {boolean} caseSensitive
     * @returns {number} количество совпадений
     */
    search(cells, query, caseSensitive) {
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

    /** Перейти к следующему совпадению (циклически). */
    next() {
        if (this.#matches.length === 0) return null;
        this.#currentIdx = (this.#currentIdx + 1) % this.#matches.length;
        return this.current();
    }

    /** Перейти к предыдущему совпадению (циклически). */
    prev() {
        if (this.#matches.length === 0) return null;
        this.#currentIdx = (this.#currentIdx - 1 + this.#matches.length) % this.#matches.length;
        return this.current();
    }

    /** Текущее совпадение. */
    current() {
        if (this.#currentIdx < 0) return null;
        return { ...this.#matches[this.#currentIdx], index: this.#currentIdx };
    }

    total() {
        return this.#matches.length;
    }

    index() {
        return this.#currentIdx;
    }

    reset() {
        this.#matches = [];
        this.#currentIdx = -1;
    }
}
