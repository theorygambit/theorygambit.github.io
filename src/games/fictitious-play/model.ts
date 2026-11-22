import type { Rng } from "../../core/Rng";

/**
 * Matching pennies under fictitious play. The matcher wants to match the other side's coin, the mismatcher wants to differ.
 * Each best responds to how often the other has shown heads so far.
 */
export const matcherNext = (headsOfOther: number, n: number): "H" | "T" => (headsOfOther * 2 >= n ? "H" : "T");
export const mismatcherNext = (headsOfOther: number, n: number): "H" | "T" => (headsOfOther * 2 > n ? "T" : "H");

/** Frequency of heads for both sides after each round, from a fixed start. */
export function simulate(rounds: number): { matcher: number[]; mismatcher: number[] } {
  let hm = 1;
  let hx = 0;
  const m = [1];
  const x = [0];
  for (let n = 1; n < rounds; n++) {
    const a = matcherNext(hx, n);
    const b = mismatcherNext(hm, n);
    if (a === "H") hm++;
    if (b === "H") hx++;
    m.push(hm / (n + 1));
    x.push(hx / (n + 1));
  }
  return { matcher: m, mismatcher: x };
}

export interface Round {
  heads: number;
  of: number;
}
/** Your history. The matcher answers it. You want to differ from what they play. */
export const FEEL_ROUNDS: readonly Round[] = [
  { heads: 3, of: 4 },
  { heads: 1, of: 4 },
  { heads: 5, of: 6 },
  { heads: 2, of: 5 },
];
export const answerOf = (r: Round): "H" | "T" => matcherNext(r.heads, r.of);
/** The move that beats the matcher. */
export const beats = (r: Round): "H" | "T" => (answerOf(r) === "H" ? "T" : "H");

export const SEE_ROUNDS = 40;

export const PROVE_POOL: readonly Round[] = [
  { heads: 3, of: 5 },
  { heads: 1, of: 5 },
  { heads: 7, of: 10 },
  { heads: 3, of: 8 },
];
export function proveSet(rng: Rng): Round[] {
  const h = PROVE_POOL.filter((r) => answerOf(r) === "H");
  const t = PROVE_POOL.filter((r) => answerOf(r) === "T");
  return rng.shuffle([rng.pick(h), rng.pick(t)]);
}
