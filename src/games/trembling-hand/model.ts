import type { Rng } from "../../core/Rng";
import { PayoffTable, type Cell } from "../shared/PayoffTable";

/**
 * A two by two game seen through a trembling hand. A stable cell can rest on a weakly dominated move,
 * which pays no more against anything and less when the other player slips. Such a cell does not survive a tremble.
 */
export class Slip {
  readonly table: PayoffTable;

  constructor(cells: readonly (readonly Cell[])[], rows: readonly string[], cols: readonly string[]) {
    this.table = new PayoffTable(cells, rows, cols);
  }

  /** Is row r weakly dominated: the other row pays at least as much against both columns, and more against one? */
  weakRow(r: number): boolean {
    const d = [0, 1].map((c) => this.table.payoff(1 - r, c)[0] - this.table.payoff(r, c)[0]);
    return d.every((x) => x >= 0) && d.some((x) => x > 0);
  }

  weakCol(c: number): boolean {
    const d = [0, 1].map((r) => this.table.payoff(r, 1 - c)[1] - this.table.payoff(r, c)[1]);
    return d.every((x) => x >= 0) && d.some((x) => x > 0);
  }

  /** Stable, and neither player plays a weakly dominated move. */
  survives(r: number, c: number): boolean {
    return this.table.isStable(r, c) && !this.weakRow(r) && !this.weakCol(c);
  }

  perfect(): [number, number] | null {
    for (const [r, c] of this.table.stable()) if (this.survives(r, c)) return [r, c];
    return null;
  }

  /** Your payoff from row r when the other player means column `safe` but slips to the other with chance e. */
  rowPay(r: number, safe: number, e: number): number {
    return (1 - e) * this.table.payoff(r, safe)[0] + e * this.table.payoff(r, 1 - safe)[0];
  }

  /** What the cell's own explanation is when it is tapped: why it fails, or empty if it survives. */
  why(r: number, c: number): string {
    const t = this.table;
    if (!t.isStable(r, c)) return `Someone gains by leaving ${t.rowNames[r]} and ${t.colNames[c]}.`;
    if (this.weakRow(r)) return `${t.rowNames[r]} never beats ${t.rowNames[1 - r]}, and loses if they slip.`;
    if (this.weakCol(c)) return `${t.colNames[c]} never beats ${t.colNames[1 - c]}, and loses if you slip.`;
    return "";
  }
}

const ROWS = ["Top", "Bottom"] as const;
const COLS = ["Left", "Right"] as const;

/** Feel: you choose between Top and Bottom, and the other player means Right but may slip to Left. */
export const FEEL = new Slip([[[4, 4], [0, 0]], [[0, 0], [0, 0]]], ROWS, COLS);
export const FEEL_SAFE = 1;
export const FEEL_ROUNDS = 5;

export function feelSlips(rng: Rng): boolean[] {
  return rng.shuffle([false, false, false, true, true]);
}

/** See: how the two rows pay as the chance of a slip grows. */
export const SEE_MAX = 0.5;

/** Prove tables: each has two stable cells and exactly one survives a tremble. */
export const PROVE_TABLES: readonly Slip[] = [
  // Survivor at top left, and it also pays more.
  new Slip([[[5, 5], [2, 0]], [[0, 2], [2, 2]]], ROWS, COLS),
  // Survivor at bottom right, and it pays less than the weak stable cell.
  new Slip([[[6, 6], [0, 6]], [[6, 0], [2, 2]]], ROWS, COLS),
  // The first one with its columns swapped: survivor at top right.
  new Slip([[[2, 0], [5, 5]], [[2, 2], [0, 2]]], ROWS, COLS),
  // The second one with its columns swapped: survivor at bottom left, paying less.
  new Slip([[[0, 6], [6, 6]], [[2, 2], [6, 0]]], ROWS, COLS),
];

export function proveSet(rng: Rng): Slip[] {
  const first = rng.pick([PROVE_TABLES[0]!, PROVE_TABLES[2]!]);
  const second = rng.pick([PROVE_TABLES[1]!, PROVE_TABLES[3]!]);
  return rng.shuffle([first, second]);
}
