import type { Rng } from "../../core/Rng";

/** A group of players. Each pays `a` every week they are still playing, and each week a share `r` of them stay. */
export class Cohort {
  readonly a: number;
  readonly r: number;

  constructor(a: number, r: number) {
    this.a = a;
    this.r = r;
  }

  /** Expected spend of one player over the first n weeks. */
  value(n: number): number {
    return this.a * ((1 - Math.pow(this.r, n)) / (1 - this.r));
  }

  /** Expected spend over the whole time they play. */
  lifetime(): number {
    return this.a / (1 - this.r);
  }

  /** Expected number of weeks a player stays. */
  weeks(): number {
    return 1 / (1 - this.r);
  }
}

export const HORIZON = 12;
export const FEEL_ROUNDS = 4;

export interface Pair {
  left: Cohort;
  right: Cohort;
}

/** Four choices. The higher spender wins in some, the better keeper in others. */
export const FEEL_PAIRS: readonly Pair[] = [
  { left: new Cohort(5, 0.5), right: new Cohort(3, 0.8) },
  { left: new Cohort(8, 0.5), right: new Cohort(3, 0.75) },
  { left: new Cohort(4, 0.6), right: new Cohort(2.5, 0.85) },
  { left: new Cohort(6, 0.7), right: new Cohort(4, 0.4) },
];

/** Same four, with the sides shuffled so a side is no clue. */
export function feelPairs(rng: Rng): Pair[] {
  return rng.shuffle(FEEL_PAIRS).map((p) => (rng.chance(0.5) ? { left: p.right, right: p.left } : p));
}

export interface LtvPuzzle {
  a: number;
  r: number;
}

export const PROVE_POOL: readonly LtvPuzzle[] = [
  { a: 6, r: 0.5 },
  { a: 3, r: 0.8 },
  { a: 2.5, r: 0.9 },
  { a: 8, r: 0.75 },
];

export function answer(p: LtvPuzzle): number {
  return new Cohort(p.a, p.r).lifetime();
}

/** Right when within 1 of the true lifetime value. */
export const TOLERANCE = 1;

export function isRight(p: LtvPuzzle, v: number): boolean {
  return Math.abs(v - answer(p)) <= TOLERANCE;
}

export function proveSet(rng: Rng): LtvPuzzle[] {
  return rng.shuffle(PROVE_POOL).slice(0, 2);
}
