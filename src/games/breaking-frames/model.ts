import { PayoffTable } from "../shared/PayoffTable";

export type Lever = "first" | "fine" | "exit";
export const LEVERS: readonly Lever[] = ["first", "fine", "exit"];
export const FINE = 3;

/**
 * A two by two standoff. Rows are your Hold and Press, columns are the rival's. Payoffs are [you, rival].
 * You may change the game instead of playing it: move first, put a fine on the rival's Press, or walk away for `exit`.
 */
export class Standoff {
  readonly cells: readonly (readonly (readonly [number, number])[])[];
  readonly exit: number;

  constructor(cells: readonly (readonly (readonly [number, number])[])[], exit: number) {
    this.cells = cells;
    this.exit = exit;
  }

  table(): PayoffTable {
    return new PayoffTable(this.cells, ["Hold", "Press"], ["Hold", "Press"]);
  }

  /** The table after a fine on the rival's Press. */
  fined(): PayoffTable {
    const c = this.cells.map((row) => row.map((cell, j) => [cell[0], cell[1] - (j === 1 ? FINE : 0)] as const));
    return new PayoffTable(c, ["Hold", "Press"], ["Hold", "Press"]);
  }

  /** Your payoff at the equilibrium of a table. Where several exist, the worst for you. */
  private at(t: PayoffTable): number {
    const e = t.stable();
    return e.length ? Math.min(...e.map(([r, c]) => t.payoff(r, c)[0])) : 0;
  }

  /** The equilibrium cell of the base game. */
  get equilibrium(): [number, number] {
    return this.table().stable()[0]!;
  }

  get base(): number {
    return this.at(this.table());
  }

  /** You commit to a row first and the rival best replies. Ties go against you. */
  get first(): number {
    const t = this.table();
    return Math.max(...[0, 1].map((r) => Math.min(...t.bestCols(r).map((c) => t.payoff(r, c)[0]))));
  }

  /** The cell you reach by moving first: your best row against a rival who best replies. */
  get firstCell(): [number, number] {
    const t = this.table();
    let best: [number, number] = [0, 0];
    let top = -Infinity;
    for (const r of [0, 1]) {
      const cols = t.bestCols(r);
      const c = cols.reduce((a, b) => (t.payoff(r, b)[0] < t.payoff(r, a)[0] ? b : a));
      if (t.payoff(r, c)[0] > top) {
        top = t.payoff(r, c)[0];
        best = [r, c];
      }
    }
    return best;
  }

  /** What the rival ends up with after a lever. A fine counts against them. */
  rival(l: Lever): number {
    if (l === "exit") return 0;
    if (l === "first") {
      const [r, c] = this.firstCell;
      return this.table().payoff(r, c)[1];
    }
    const t = this.fined();
    const [r, c] = t.stable()[0]!;
    return t.payoff(r, c)[1];
  }

  /** The cell where the fined table settles. */
  get fineCell(): [number, number] {
    return this.fined().stable()[0]!;
  }

  get fine(): number {
    return this.at(this.fined());
  }

  result(l: Lever): number {
    return l === "first" ? this.first : l === "fine" ? this.fine : this.exit;
  }

  /** The lever that helps you most, or null if none beats the base game. */
  get best(): Lever | null {
    const top = Math.max(...LEVERS.map((l) => this.result(l)));
    if (top <= this.base) return null;
    return LEVERS.find((l) => this.result(l) === top) ?? null;
  }

  get unique(): boolean {
    return this.table().stable().length === 1 && this.fined().stable().length === 1;
  }
}

/** The Feel game: the rival's Press beats Hold whatever you do, and you are left with 1 against 5. */
export const FEEL_STANDOFF = new Standoff(
  [
    [[3, 3], [1, 5]],
    [[4, 0], [0, 2]],
  ],
  2,
);

/** New standoffs for Prove. A different lever wins in each. */
export const PROVE_STANDOFFS: readonly Standoff[] = [
  new Standoff([[[5, 0], [0, 4]], [[4, 3], [0, 1]]], 2),
  new Standoff([[[1, 2], [0, 2]], [[2, 6], [4, 4]]], 4),
  new Standoff([[[5, 1], [0, 2]], [[0, 5], [2, 6]]], 2),
];
