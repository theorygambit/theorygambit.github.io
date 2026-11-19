export interface Dominated {
  index: number;
  by: number;
}

export interface Step {
  kind: "row" | "col";
  index: number;
  by: number;
}

/**
 * A two player payoff table of any size. Rows belong to you, columns to the other player.
 * `a` holds your payoffs and `b` holds theirs. Pure logic, no drawing.
 */
export class Bimatrix {
  readonly a: readonly (readonly number[])[];
  readonly b: readonly (readonly number[])[];

  constructor(a: readonly (readonly number[])[], b: readonly (readonly number[])[]) {
    this.a = a;
    this.b = b;
  }

  get rows(): number {
    return this.a.length;
  }

  get cols(): number {
    return this.a[0]!.length;
  }

  /** A constant sum table: you get `v`, they get `total - v`. */
  static constantSum(a: readonly (readonly number[])[], total: number): Bimatrix {
    return new Bimatrix(a, a.map((r) => r.map((v) => total - v)));
  }

  mine(r: number, c: number): number {
    return this.a[r]![c]!;
  }

  theirs(r: number, c: number): number {
    return this.b[r]![c]!;
  }

  /** Every row that is best for you against column c. */
  bestRows(c: number): number[] {
    const top = Math.max(...this.a.map((row) => row[c]!));
    return this.a.map((row, r) => (row[c] === top ? r : -1)).filter((r) => r >= 0);
  }

  /** Every column that is best for them against row r. */
  bestCols(r: number): number[] {
    const top = Math.max(...this.b[r]!);
    return this.b[r]!.map((v, c) => (v === top ? c : -1)).filter((c) => c >= 0);
  }

  isEquilibrium(r: number, c: number): boolean {
    return this.bestRows(c).includes(r) && this.bestCols(r).includes(c);
  }

  equilibria(): [number, number][] {
    const out: [number, number][] = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.isEquilibrium(r, c)) out.push([r, c]);
    return out;
  }

  /** Does anyone gain by moving away from cell (r, c)? Returns the best move for each side, or null. */
  deviations(r: number, c: number): { row: number | null; col: number | null } {
    const br = this.bestRows(c);
    const bc = this.bestCols(r);
    return { row: br.includes(r) ? null : br[0]!, col: bc.includes(c) ? null : bc[0]! };
  }

  /** A row that is strictly worse than another alive row against every alive column. */
  dominatedRow(rows: readonly number[], cols: readonly number[]): Dominated | null {
    for (const i of rows) for (const j of rows) {
      if (i !== j && cols.every((c) => this.a[j]![c]! > this.a[i]![c]!)) return { index: i, by: j };
    }
    return null;
  }

  dominatedCol(rows: readonly number[], cols: readonly number[]): Dominated | null {
    for (const i of cols) for (const j of cols) {
      if (i !== j && rows.every((r) => this.b[r]![j]! > this.b[r]![i]!)) return { index: i, by: j };
    }
    return null;
  }

  /** Strike strictly dominated rows and columns, one at a time, rows first, until nothing is left to strike. */
  iterate(): { steps: Step[]; rows: number[]; cols: number[] } {
    let rows = this.a.map((_, i) => i);
    let cols = this.a[0]!.map((_, i) => i);
    const steps: Step[] = [];
    for (;;) {
      const dr = this.dominatedRow(rows, cols);
      if (dr) {
        steps.push({ kind: "row", ...dr });
        rows = rows.filter((r) => r !== dr.index);
        continue;
      }
      const dc = this.dominatedCol(rows, cols);
      if (dc) {
        steps.push({ kind: "col", ...dc });
        cols = cols.filter((c) => c !== dc.index);
        continue;
      }
      return { steps, rows, cols };
    }
  }

  /** The best you can guarantee with a pure row: the row with the highest worst case. */
  maximin(): { row: number; value: number; worst: number[] } {
    const worst = this.a.map((row) => Math.min(...row));
    const value = Math.max(...worst);
    return { row: worst.indexOf(value), value, worst };
  }

  /** The least they can hold you to with a pure column: the column with the lowest best case for you. */
  minimax(): { col: number; value: number; best: number[] } {
    const best = this.a[0]!.map((_, c) => Math.max(...this.a.map((row) => row[c]!)));
    const value = Math.min(...best);
    return { col: best.indexOf(value), value, best };
  }

  /** A pure saddle point exists when both numbers agree. */
  saddle(): [number, number] | null {
    const mm = this.maximin();
    const mx = this.minimax();
    if (mm.value !== mx.value) return null;
    return [mm.row, mx.col];
  }

  /** The column that hurts you most when you play row r. */
  worstCol(r: number): number {
    const row = this.a[r]!;
    return row.indexOf(Math.min(...row));
  }
}
