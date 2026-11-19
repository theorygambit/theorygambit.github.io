import type { Rng } from "../../core/Rng";

/**
 * Both name a claim from `lo` to `hi`. Both are paid the lower claim. The lower claimer gets
 * `bonus` extra and the higher claimer pays `bonus`. Equal claims are paid as claimed.
 */
export class Travelers {
  readonly lo: number;
  readonly hi: number;
  readonly bonus: number;

  constructor(lo = 2, hi = 10, bonus = 2) {
    this.lo = lo;
    this.hi = hi;
    this.bonus = bonus;
  }

  payoff(mine: number, theirs: number): number {
    if (mine < theirs) return mine + this.bonus;
    if (mine > theirs) return theirs - this.bonus;
    return mine;
  }

  /** Your best claim against a partner claim. Ties go to the higher claim. */
  bestReply(theirs: number): number {
    let best = this.lo;
    let top = -Infinity;
    for (let x = this.lo; x <= this.hi; x++) {
      const v = this.payoff(x, theirs);
      if (v >= top) {
        top = v;
        best = x;
      }
    }
    return best;
  }

  /** The chain of best replies from a starting claim, until it stops moving. */
  staircase(from: number): number[] {
    const out = [from];
    for (;;) {
      const next = this.bestReply(out[out.length - 1]!);
      if (next === out[out.length - 1]) return out;
      out.push(next);
    }
  }
}

export const FEEL_GAME = new Travelers(2, 10, 2);

/** Partner claims in Feel: people stay high. */
export function partnerClaims(rng: Rng): number[] {
  return rng.shuffle([10, 9, 10]);
}

export interface TravelCase {
  game: Travelers;
  partner: number;
  answer: number;
}

/** Different bonus, range and partner claim. One has a small bonus, where matching is the best reply. */
export const PROVE_POOL: readonly TravelCase[] = [
  { game: new Travelers(2, 12, 3), partner: 9, answer: 8 },
  { game: new Travelers(2, 10, 0.5), partner: 7, answer: 7 },
  { game: new Travelers(2, 14, 4), partner: 11, answer: 10 },
  { game: new Travelers(2, 9, 0.5), partner: 6, answer: 6 },
  { game: new Travelers(2, 11, 2), partner: 8, answer: 7 },
];
