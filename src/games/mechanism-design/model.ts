import type { Rng } from "../../core/Rng";

export type Rule = "chooser" | "divider";

/**
 * You cut a pie of size N into two pieces. Under the "chooser" rule the other player takes the bigger piece first.
 * Under the "divider" rule you take the bigger piece. A selfish divider cuts to get the most from the rule.
 */
export class Cake {
  readonly n: number;
  readonly rule: Rule;

  constructor(n: number, rule: Rule) {
    this.n = n;
    this.rule = rule;
  }

  /** What the divider gets from a cut where one piece is a (the other is n - a). */
  share(a: number): number {
    const lo = Math.min(a, this.n - a);
    return this.rule === "chooser" ? lo : this.n - lo;
  }

  /** The cut that gives the divider the most: the smaller piece size. */
  bestCut(): number {
    return this.rule === "chooser" ? this.n / 2 : 0;
  }
}

export const FEEL_N = 10;
export interface Round {
  a: number;
  b: number;
}
/** Two cuts to choose between, written as the smaller piece. */
export const FEEL_ROUNDS: readonly Round[] = [
  { a: 2, b: 5 },
  { a: 4, b: 3 },
  { a: 5, b: 1 },
  { a: 3, b: 4 },
];

export const SEE_N = 10;
export const PROVE_N: readonly number[] = [8, 12, 14, 18];

export interface Puzzle {
  cake: Cake;
  /** Index (0 or 1) of the choice that is the even split. */
  evenAt: 0 | 1;
}

export function proveSet(rng: Rng): Puzzle[] {
  const ns = rng.shuffle([...PROVE_N]);
  const rules = rng.shuffle<Rule>(["chooser", "divider"]);
  return [0, 1].map((i) => ({ cake: new Cake(ns[i]!, rules[i]!), evenAt: rng.chance(0.5) ? 0 : 1 }));
}

/** Index of the right choice. */
export const answer = (p: Puzzle): 0 | 1 => (p.cake.rule === "chooser" ? p.evenAt : ((1 - p.evenAt) as 0 | 1));
