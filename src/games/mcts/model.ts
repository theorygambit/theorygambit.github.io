import type { Rng } from "../../core/Rng";

/** The upper confidence score search uses to choose which move to try next. */
export const C = 0.5;
export const ucb = (wins: number, tries: number, total: number): number => wins / tries + C * Math.sqrt(Math.log(total) / tries);

export interface Stat {
  wins: number;
  tries: number;
  /** The true win rate, hidden until after. */
  truth: number;
}
export interface Round {
  a: Stat;
  b: Stat;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { a: { wins: 1, tries: 1, truth: 0.3 }, b: { wins: 6, tries: 10, truth: 0.6 } },
  { a: { wins: 1, tries: 2, truth: 0.7 }, b: { wins: 5, tries: 10, truth: 0.5 } },
  { a: { wins: 9, tries: 10, truth: 0.9 }, b: { wins: 2, tries: 2, truth: 0.4 } },
  { a: { wins: 4, tries: 8, truth: 0.5 }, b: { wins: 0, tries: 1, truth: 0.7 } },
];
export const PRIZE = 6;

export const SEE_TOTAL = 100;
export const SEE_WINRATE = 0.5;

export interface Case {
  total: number;
  a: { wins: number; tries: number };
  b: { wins: number; tries: number };
}
export const PROVE_POOL: readonly Case[] = [
  { total: 50, a: { wins: 3, tries: 5 }, b: { wins: 12, tries: 20 } },
  { total: 50, a: { wins: 8, tries: 10 }, b: { wins: 1, tries: 2 } },
  { total: 50, a: { wins: 30, tries: 40 }, b: { wins: 5, tries: 10 } },
  { total: 50, a: { wins: 1, tries: 5 }, b: { wins: 2, tries: 3 } },
];
/** The slot of the move search tries next. */
export const next = (c: Case): 0 | 1 => (ucb(c.a.wins, c.a.tries, c.total) >= ucb(c.b.wins, c.b.tries, c.total) ? 0 : 1);

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
