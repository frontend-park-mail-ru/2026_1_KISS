interface CellInput {
    id: number | string;
    kind: 'code' | 'text';
    content: string;
}

interface MatchEntry {
    blockId: number | string;
    kind: 'code' | 'text';
    start: number;
    end: number;
}

interface MatchResult extends MatchEntry {
    index: number;
}

export class FindEngine {
    #matches: MatchEntry[] = [];
    #currentIdx = -1;

    search(cells: CellInput[], query: string, caseSensitive: boolean): number {
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

    next(): MatchResult | null {
        if (this.#matches.length === 0) return null;
        this.#currentIdx = (this.#currentIdx + 1) % this.#matches.length;
        return this.current();
    }

    prev(): MatchResult | null {
        if (this.#matches.length === 0) return null;
        this.#currentIdx = (this.#currentIdx - 1 + this.#matches.length) % this.#matches.length;
        return this.current();
    }

    current(): MatchResult | null {
        if (this.#currentIdx < 0) return null;
        return { ...this.#matches[this.#currentIdx], index: this.#currentIdx };
    }

    total(): number {
        return this.#matches.length;
    }

    index(): number {
        return this.#currentIdx;
    }

    reset(): void {
        this.#matches = [];
        this.#currentIdx = -1;
    }
}
