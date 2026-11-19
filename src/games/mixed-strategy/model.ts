import type { Rng } from "../../core/Rng";

export type Dive = 0 | 1;

/**
 * A penalty kick. `hit[kick][dive]` is the chance the kick scores. Kicking left against a dive left
 * is the weak case. The kicker mixes: `p` is the share of kicks to the left.
 */
export class Penalty {
  readonly hit: readonly (readonly number[])[];

  constructor(ll: number, lr: number, rl: number, rr: number) {
    this.hit = [[ll, lr], [rl, rr]];
  }

  chance(kick: 0 | 1, dive: Dive): number {
    return this.hit[kick]![dive]!;
  }

  /** Scoring chance if you kick left with probability p and the keeper dives `dive`. */
  against(p: number, dive: Dive): number {
    return p * this.hit[0]![dive]! + (1 - p) * this.hit[1]![dive]!;
  }

  /** The keeper's best dive against your mix. */
  keeperBest(p: number): Dive {
    return this.against(p, 0) <= this.against(p, 1) ? 0 : 1;
  }

  /** Your share of left kicks that leaves the keeper indifferent. */
  get indifference(): number {
    const [[ll, lr], [rl, rr]] = this.hit as [[number, number], [number, number]];
    return (rr - rl) / (ll - rl - lr + rr);
  }

  /** The scoring chance you lock in by playing the indifference mix. */
  get value(): number {
    return this.against(this.indifference, 0);
  }

  /** True when no pure kick is safe: the table has no saddle, so mixing is needed. */
  get needsMixing(): boolean {
    const p = this.indifference;
    return p > 0.05 && p < 0.95;
  }
}

export const FEEL_PENALTY = new Penalty(0.4, 0.9, 0.8, 0.6);

/** Prove tables with different indifference points, at 0.73 and 0.13, far from the Feel one (0.29) and one half. */
export const PROVE_PENALTIES: readonly Penalty[] = [new Penalty(0.6, 0.3, 0.1, 0.9), new Penalty(0.2, 0.9, 0.8, 0.7)];

export const PROVE_TOLERANCE = 0.06;

/** The keeper dives toward the side you have kicked more, and guesses when it is level. */
export function keeperDive(history: readonly (0 | 1)[], rng: Rng): Dive {
  const left = history.filter((k) => k === 0).length;
  const right = history.length - left;
  if (left === right) return rng.chance(0.5) ? 0 : 1;
  return left > right ? 0 : 1;
}
