import type { Rng } from "../../core/Rng";

export type Row = 0 | 1;
export type Col = 0 | 1;

/** A 2x2 payoff table for the row player. Rows are yours, columns are theirs. */
export class DominanceMatrix {
  readonly u: readonly (readonly number[])[];

  constructor(u: number[][]) {
    this.u = u;
  }

  payoff(r: Row, c: Col): number {
    return this.u[r]![c]!;
  }

  other(r: Row): Row {
    return r === 0 ? 1 : 0;
  }

  /** The strictly better row against a column, or null on a tie. */
  bestRow(c: Col): Row | null {
    const a = this.payoff(0, c);
    const b = this.payoff(1, c);
    return a === b ? null : a > b ? 0 : 1;
  }

  /** A row that is strictly better in every column, or null when none exists. */
  dominantRow(): Row | null {
    const b0 = this.bestRow(0);
    const b1 = this.bestRow(1);
    return b0 !== null && b0 === b1 ? b0 : null;
  }

  /** Random puzzle with a known answer. `want` is the dominant row, or null for none. */
  static generate(rng: Rng, want: Row | null): DominanceMatrix {
    for (let tries = 0; tries < 400; tries++) {
      const m = want === null ? DominanceMatrix.draftNone(rng) : DominanceMatrix.draftDominant(rng, want);
      if (m.dominantRow() === want && DominanceMatrix.hasNoTies(m)) return m;
    }
    return want === 1 ? new DominanceMatrix([[5, 2], [6, 3]]) : want === 0 ? new DominanceMatrix([[6, 3], [5, 2]]) : new DominanceMatrix([[6, 1], [3, 4]]);
  }

  private static hasNoTies(m: DominanceMatrix): boolean {
    return m.bestRow(0) !== null && m.bestRow(1) !== null;
  }

  private static draftDominant(rng: Rng, dom: Row): DominanceMatrix {
    const low = [rng.int(1, 6), rng.int(1, 6)];
    const high = low.map((v) => Math.min(9, v + rng.int(1, 3)));
    const rows = dom === 0 ? [high, low] : [low, high];
    return new DominanceMatrix(rows);
  }

  private static draftNone(rng: Rng): DominanceMatrix {
    const first = rng.int(0, 1) as Row;
    const a = rng.int(2, 8);
    const b = rng.int(2, 8);
    const rows: number[][] = [[0, 0], [0, 0]];
    rows[first]![0] = Math.min(9, a + rng.int(1, 3));
    rows[first === 0 ? 1 : 0]![0] = a;
    rows[first === 0 ? 1 : 0]![1] = Math.min(9, b + rng.int(1, 3));
    rows[first]![1] = b;
    return new DominanceMatrix(rows);
  }
}

/** The matrix used in the Feel round. Up looks tempting (a 5) but Down wins everywhere. */
export const FEEL_MATRIX = new DominanceMatrix([
  [5, 2],
  [6, 3],
]);

/** Columns the other player will pick over four rounds: both appear twice, in a random order. */
export function feelColumns(rng: Rng): Col[] {
  return rng.shuffle<Col>([0, 1, 0, 1]);
}

/** Three Prove puzzles: one dominant, one with none, one dominant on the other row. */
export function proveSet(rng: Rng): { matrix: DominanceMatrix; answer: Row | null }[] {
  const first = rng.int(0, 1) as Row;
  const answers: (Row | null)[] = rng.shuffle<Row | null>([first, null, first === 0 ? 1 : 0]);
  return answers.map((answer) => ({ matrix: DominanceMatrix.generate(rng, answer), answer }));
}
