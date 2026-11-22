import type { Rng } from "../../core/Rng";

/** Two options, A and B. How often each is clicked depends on who is looking. */
export interface Context {
  who: string;
  a: number;
  b: number;
}
export const FEEL_ROUNDS: readonly Context[] = [
  { who: "commuter", a: 0.2, b: 0.5 },
  { who: "night owl", a: 0.7, b: 0.3 },
  { who: "student", a: 0.4, b: 0.6 },
  { who: "parent", a: 0.8, b: 0.4 },
];
export const PRIZE = 6;
export const better = (c: Context): 0 | 1 => (c.a >= c.b ? 0 : 1);

/** Exploring a share eps of the time. A rule that never explores can get stuck on the wrong option. */
export const BEST = 0.6;
export const AVG = 0.4;
export const GAP = 0.3;
export const reward = (eps: number): number => BEST - eps * (BEST - AVG) - GAP * Math.exp(-15 * eps);

export const PROVE_POOL: readonly (Context & { overallA: number; overallB: number })[] = [
  { who: "gamer", a: 0.2, b: 0.5, overallA: 55, overallB: 40 },
  { who: "reader", a: 0.6, b: 0.3, overallA: 35, overallB: 45 },
  { who: "traveller", a: 0.45, b: 0.35, overallA: 30, overallB: 50 },
  { who: "shopper", a: 0.3, b: 0.65, overallA: 60, overallB: 35 },
];
export type Case = (typeof PROVE_POOL)[number];

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
