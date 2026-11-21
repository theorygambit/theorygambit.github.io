import type { Rng } from "../../core/Rng";

export type Move = "go" | "wait";

/**
 * Chicken with a traffic light. Both wait pays r each, one goes and one waits pays t to the one who goes and s to the one who waits,
 * and both go crash for 0. The light picks (go, wait) or (wait, go) with chance a each, and (wait, wait) with the rest.
 * Each player is told only their own move.
 */
export class Light {
  readonly r: number;
  readonly s: number;
  readonly t: number;

  constructor(r: number, s: number, t: number) {
    this.r = r;
    this.s = s;
    this.t = t;
  }

  /** What you get for your move against theirs. */
  pay(mine: Move, theirs: Move): number {
    if (mine === "go") return theirs === "wait" ? this.t : 0;
    return theirs === "wait" ? this.r : this.s;
  }

  /** Chance the other player was told to go, given you were told to wait. */
  rivalGoesGivenWait(a: number): number {
    return a / (1 - a);
  }

  /** Your expected pay if told to wait and you obey. */
  obeyWait(a: number): number {
    const g = this.rivalGoesGivenWait(a);
    return g * this.s + (1 - g) * this.r;
  }

  /** Your expected pay if told to wait and you go anyway. */
  goWait(a: number): number {
    const g = this.rivalGoesGivenWait(a);
    return (1 - g) * this.t;
  }

  /** How much better obeying a wait is than going. Positive means obeying is best. */
  edge(a: number): number {
    return this.obeyWait(a) - this.goWait(a);
  }

  /** The smallest chance of each go signal at which a player told to wait is happy to wait. */
  minChance(): number {
    const d = this.t - this.r;
    return d / (this.s + 2 * d);
  }

  /** Told to go the other player waits for sure, so going pays t and waiting pays r. Obeying always wins. */
  obeyGo(): number {
    return this.t;
  }

  ignoreGo(): number {
    return this.r;
  }

  /** Is obeying best for a player told to wait? */
  obedient(a: number): boolean {
    return this.edge(a) >= 0;
  }
}

export const FEEL = new Light(6, 2, 7);
export const FEEL_A = 1 / 3;
export const FEEL_ROUNDS = 5;

export type Profile = readonly [Move, Move];

export const PROFILES: readonly Profile[] = [
  ["go", "wait"],
  ["wait", "go"],
  ["wait", "wait"],
];

/** Draws the Feel signals: every profile at least once. */
export function feelSignals(rng: Rng): Profile[] {
  return rng.shuffle([PROFILES[0]!, PROFILES[1]!, PROFILES[2]!, rng.pick(PROFILES), rng.pick(PROFILES)]);
}

export const PROVE_POOL: readonly Light[] = [new Light(8, 3, 9), new Light(6, 1, 8), new Light(7, 2, 10), new Light(10, 4, 13)];

export const TOLERANCE = 0.03;

export function isRight(l: Light, a: number): boolean {
  return Math.abs(a - l.minChance()) <= TOLERANCE;
}

export function proveSet(rng: Rng): Light[] {
  return rng.shuffle(PROVE_POOL).slice(0, 2);
}
