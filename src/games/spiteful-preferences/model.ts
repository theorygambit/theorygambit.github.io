import type { Rng } from "../../core/Rng";

/** A spiteful player's utility: own payoff less `spite` times the other's. */
export const utility = (own: number, other: number, spite: number): number => own - spite * other;

export const FEEL_SPITE = 0.5;
export const FEEL_OWN = 6;
export const FEEL_OTHER = 6;
export interface Round {
  cost: number;
  harm: number;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { cost: 1, harm: 6 },
  { cost: 2, harm: 2 },
  { cost: 3, harm: 4 },
  { cost: 1, harm: 4 },
];
/** Utility if you pay `cost` to cut their payoff by `harm`. */
export const burn = (r: Round, s = FEEL_SPITE): number => utility(FEEL_OWN - r.cost, FEEL_OTHER - r.harm, s);
export const keep = (s = FEEL_SPITE): number => utility(FEEL_OWN, FEEL_OTHER, s);

export const SEE_COST = 2;
export const SEE_HARM = 6;

export interface Case {
  cost: number;
  harm: number;
}
export const PROVE_POOL: readonly Case[] = [
  { cost: 2, harm: 8 },
  { cost: 3, harm: 6 },
  { cost: 1, harm: 4 },
  { cost: 3, harm: 4 },
  { cost: 2, harm: 5 },
];
/** The spite, in percent, at which paying to harm is just worth it. */
export const threshold = (c: Case): number => Math.round((c.cost / c.harm) * 100);

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
export const isRight = (c: Case, v: number, tol = 4): boolean => Math.abs(v - threshold(c)) <= tol + 1e-9;
