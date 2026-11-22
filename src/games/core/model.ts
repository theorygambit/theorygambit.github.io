import type { Rng } from "../../core/Rng";

/**
 * Three players. Any two together can earn `pair`, alone each earns nothing, and all three earn `total`.
 * A split is in the core when no group can do better on its own, so every pair keeps at least `pair`.
 */
export class Trio {
  readonly pair: number;
  readonly total: number;

  constructor(pair: number, total = 12) {
    this.pair = pair;
    this.total = total;
  }

  /** The pair that would walk away, as the two players left out and the one kept, or null when the split is stable. */
  blocker(x: readonly number[]): [number, number] | null {
    for (const [i, j] of [[1, 2], [0, 2], [0, 1]] as const) if (x[i]! + x[j]! < this.pair - 1e-9) return [i, j];
    return null;
  }

  stable(x: readonly number[]): boolean {
    return this.blocker(x) === null;
  }

  /** Your pay as player 1: your share, or nothing when a pair of the others leaves with the deal. */
  mine(x: readonly number[]): number {
    const b = this.blocker(x);
    return b !== null && b[0] === 1 && b[1] === 2 ? 0 : x[0]!;
  }
}

export interface Round {
  pair: number;
  a: [number, number, number];
  b: [number, number, number];
}
export const FEEL_ROUNDS: readonly Round[] = [
  { pair: 8, a: [4, 4, 4], b: [6, 3, 3] },
  { pair: 7, a: [6, 3, 3], b: [5, 4, 3] },
  { pair: 8, a: [3, 4, 5], b: [4, 4, 4] },
  { pair: 6, a: [2, 5, 5], b: [4, 4, 4] },
];

export const SEE = new Trio(6);

export interface Case {
  game: Trio;
  x: [number, number, number];
}
export const PROVE_POOL: readonly Case[] = [
  { game: new Trio(8), x: [4, 4, 4] },
  { game: new Trio(8), x: [5, 4, 3] },
  { game: new Trio(9), x: [4, 4, 4] },
  { game: new Trio(5), x: [7, 3, 2] },
  { game: new Trio(7), x: [2, 5, 5] },
  { game: new Trio(7), x: [3, 3, 6] },
];

/** One that holds and one that does not. */
export function proveSet(rng: Rng): Case[] {
  const yes = PROVE_POOL.filter((c) => c.game.stable(c.x));
  const no = PROVE_POOL.filter((c) => !c.game.stable(c.x));
  return rng.shuffle([rng.pick(yes), rng.pick(no)]);
}
