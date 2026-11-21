import type { Rng } from "../../core/Rng";

export type Row = 0 | 1;
export type Col = 0 | 1;

/** Your payoffs in a 2x2 situation. Rows are your options, columns are the other side's. */
export class PayoffTable {
  readonly u: readonly (readonly number[])[];

  constructor(u: number[][]) {
    this.u = u;
  }

  payoff(r: Row, c: Col): number {
    return this.u[r]![c]!;
  }

  /** The strictly better row against a column, or null on a tie. */
  bestRow(c: Col): Row | null {
    const a = this.payoff(0, c);
    const b = this.payoff(1, c);
    return a === b ? null : a > b ? 0 : 1;
  }

  /** It is a game when the best move changes with the other side's move. */
  isInterdependent(): boolean {
    const a = this.bestRow(0);
    const b = this.bestRow(1);
    return a !== null && b !== null && a !== b;
  }

  with(r: Row, c: Col, v: number): PayoffTable {
    return new PayoffTable(this.u.map((row, i) => row.map((x, j) => (i === r && j === c ? v : x))));
  }
}

/** Two lanes. The same lane crashes. A different lane is safe. */
export const LANES = new PayoffTable([[0, 3], [3, 0]]);
/** On an empty road nothing the others do matters. */
export const ALONE = new PayoffTable([[3, 3], [3, 3]]);

/** Which lane the other driver is in during the three shared rounds. */
export const laneSequence = (rng: Rng): Col[] => rng.shuffle<Col>([0, 1, 1]);

export interface FlipPuzzle {
  table: PayoffTable;
  /** The cell the player drags. */
  cell: [Row, Col];
  /** The smallest value for that cell that makes the table interdependent. */
  needs: number;
}

/** Two tables where one row beats the other everywhere. Raise one cell of the weaker row to make it a game. */
export function flipPuzzles(rng: Rng): FlipPuzzle[] {
  const first = rng.int(0, 1) as Row;
  return [first, (1 - first) as Row].map((strong) => {
    const weak = (1 - strong) as Row;
    const d = rng.int(4, 6);
    const l = rng.int(1, 3);
    const rows: number[][] = [[0, 0], [0, 0]];
    rows[strong] = [d, d];
    rows[weak] = [l, l];
    const col = rng.int(0, 1) as Col;
    return { table: new PayoffTable(rows), cell: [weak, col] as [Row, Col], needs: d + 1 };
  });
}
