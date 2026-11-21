import type { Rng } from "../../core/Rng";

export type Cell = [number, number];

/** pay[row][col] = [you, they]. Rows are yours, columns are theirs. */
export class OrderGame {
  readonly pay: Cell[][];

  constructor(pay: Cell[][]) {
    this.pay = pay;
  }

  /** Their best column once your row is known. */
  theirBest(row: number): 0 | 1 {
    return this.pay[row]![0]![1] >= this.pay[row]![1]![1] ? 0 : 1;
  }

  /** Your best row once their column is known. */
  yourBest(col: number): 0 | 1 {
    return this.pay[0]![col]![0] >= this.pay[1]![col]![0] ? 0 : 1;
  }

  /** You commit first, they react. Backward induction. */
  youFirst(): { row: 0 | 1; col: 0 | 1; pay: Cell } {
    const r0 = this.pay[0]![this.theirBest(0)]![0];
    const r1 = this.pay[1]![this.theirBest(1)]![0];
    const row: 0 | 1 = r0 >= r1 ? 0 : 1;
    const col = this.theirBest(row);
    return { row, col, pay: this.pay[row]![col]! };
  }

  /** They commit first, you react. */
  theyFirst(): { row: 0 | 1; col: 0 | 1; pay: Cell } {
    const c0 = this.pay[this.yourBest(0)]![0]![1];
    const c1 = this.pay[this.yourBest(1)]![1]![1];
    const col: 0 | 1 = c0 >= c1 ? 0 : 1;
    const row = this.yourBest(col);
    return { row, col, pay: this.pay[row]![col]! };
  }
}

/** Two good meeting points, and each side prefers a different one. */
export const BATTLE = new OrderGame([[[3, 2], [0, 0]], [[0, 0], [2, 3]]]);

/** New tables with no ties, where who moves first changes where play ends. */
export function newGame(rng: Rng): OrderGame {
  for (let tries = 0; tries < 2000; tries++) {
    const pay: Cell[][] = [0, 1].map(() => [0, 1].map(() => [rng.int(0, 9), rng.int(0, 9)] as Cell));
    const strict =
      pay[0]![0]![1] !== pay[0]![1]![1] &&
      pay[1]![0]![1] !== pay[1]![1]![1] &&
      pay[0]![0]![0] !== pay[1]![0]![0] &&
      pay[0]![1]![0] !== pay[1]![1]![0];
    if (!strict) continue;
    const g = new OrderGame(pay);
    const a = g.youFirst();
    const b = g.theyFirst();
    const r0 = pay[0]![g.theirBest(0)]![0];
    const r1 = pay[1]![g.theirBest(1)]![0];
    if (r0 === r1) continue;
    if (a.row === b.row && a.col === b.col) continue;
    return g;
  }
  return BATTLE;
}
