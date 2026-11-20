/** A payoff for [you, the other player]. */
export type Cell = readonly [number, number];

/**
 * A two player table. Rows belong to you, columns to the other player.
 * Pure logic: best replies and which cells nobody wants to leave.
 */
export class PayoffTable {
  readonly cells: readonly (readonly Cell[])[];
  readonly rowNames: readonly string[];
  readonly colNames: readonly string[];

  constructor(cells: readonly (readonly Cell[])[], rowNames: readonly string[], colNames: readonly string[]) {
    this.cells = cells;
    this.rowNames = rowNames;
    this.colNames = colNames;
  }

  payoff(r: number, c: number): Cell {
    return this.cells[r]![c]!;
  }

  /** Your best rows against column c. Ties return every tied row. */
  bestRows(c: number): number[] {
    const v = this.cells.map((row) => row[c]![0]);
    const m = Math.max(...v);
    return v.flatMap((x, i) => (x === m ? [i] : []));
  }

  /** Their best columns against row r. */
  bestCols(r: number): number[] {
    const v = this.cells[r]!.map((cell) => cell[1]);
    const m = Math.max(...v);
    return v.flatMap((x, i) => (x === m ? [i] : []));
  }

  /** Nobody gains by moving alone. */
  isStable(r: number, c: number): boolean {
    return this.bestRows(c).includes(r) && this.bestCols(r).includes(c);
  }

  stable(): [number, number][] {
    const out: [number, number][] = [];
    for (let r = 0; r < this.cells.length; r++) for (let c = 0; c < this.cells[r]!.length; c++) if (this.isStable(r, c)) out.push([r, c]);
    return out;
  }

  /** Largest payoff in the table, for scaling discs. */
  get max(): number {
    return Math.max(...this.cells.flat().flatMap((c) => [c[0], c[1]]));
  }
}
