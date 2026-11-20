import type { Rng } from "../../core/Rng";

/** Troops in each of three fields. */
export type Alloc = readonly [number, number, number];

/**
 * Three fields. Each goes to the side with more troops there, and a tie goes to nobody.
 * You win the war by holding more fields than they do. `troops` is what YOU have to spend.
 */
export class Blotto {
  readonly troops: number;

  constructor(troops: number) {
    this.troops = troops;
  }

  /** Fields a holds against b. */
  static held(a: Alloc, b: Alloc): number {
    return (a[0] > b[0] ? 1 : 0) + (a[1] > b[1] ? 1 : 0) + (a[2] > b[2] ? 1 : 0);
  }

  /** Does a win the war against b? */
  static wins(a: Alloc, b: Alloc): boolean {
    return Blotto.held(a, b) > Blotto.held(b, a);
  }

  /** Every way to split your troops over three fields. */
  lattice(): Alloc[] {
    const out: Alloc[] = [];
    for (let a = 0; a <= this.troops; a++) for (let b = 0; a + b <= this.troops; b++) out.push([a, b, this.troops - a - b]);
    return out;
  }

  /** Every split of yours that beats the opponent's. */
  counters(opp: Alloc): Alloc[] {
    return this.lattice().filter((a) => Blotto.wins(a, opp));
  }

  /** A winning split that pays just enough for the two cheapest fields and sends the rest to the dearest. Null if none. */
  cheapestCounter(opp: Alloc): Alloc | null {
    const order = [0, 1, 2].sort((i, j) => opp[i]! - opp[j]! || i - j);
    const [i, j, k] = order as [number, number, number];
    const need = opp[i]! + 1 + opp[j]! + 1;
    if (need > this.troops) return null;
    const out = [0, 0, 0];
    out[i] = opp[i]! + 1;
    out[j] = opp[j]! + 1;
    out[k] = this.troops - need;
    return out as unknown as Alloc;
  }
}

export const FEEL_TROOPS = 12;
export const FEEL_ROUNDS = 4;

/** What the opponents of the Feel rounds send. Each sums to 12. */
export const FEEL_TYPES: readonly Alloc[] = [
  [4, 4, 4],
  [6, 6, 0],
  [8, 2, 2],
  [5, 4, 3],
  [7, 5, 0],
  [9, 3, 0],
];

/** Four different opponents, each with the fields shuffled so no lane is predictable. */
export function feelOpponents(rng: Rng): Alloc[] {
  return rng.shuffle(FEEL_TYPES).slice(0, FEEL_ROUNDS).map((t) => rng.shuffle(t) as unknown as Alloc);
}

export interface BlottoPuzzle {
  you: number;
  opp: Alloc;
}

/** Prove cases: different totals, so a remembered split cannot be reused. Every one has a winning split. */
export const PROVE_POOL: readonly BlottoPuzzle[] = [
  { you: 10, opp: [4, 4, 4] },
  { you: 15, opp: [7, 7, 1] },
  { you: 12, opp: [5, 5, 2] },
  { you: 9, opp: [5, 2, 2] },
];

export function proveSet(rng: Rng): BlottoPuzzle[] {
  return rng.shuffle(PROVE_POOL).slice(0, 2);
}
