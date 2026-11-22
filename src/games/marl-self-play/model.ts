import type { Rng } from "../../core/Rng";

/** You learn fastest against an opponent near your own level. Too easy teaches nothing new. Too hard teaches nothing you can use. */
export const gain = (you: number, opp: number): number => 6 * Math.max(0, 1 - Math.abs(opp - you) / 40);

export interface Round {
  you: number;
  a: number;
  b: number;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { you: 20, a: 10, b: 25 },
  { you: 40, a: 30, b: 80 },
  { you: 60, a: 90, b: 60 },
  { you: 80, a: 70, b: 40 },
];

export const SEE_YOU = 50;

export interface Case {
  you: number;
  opp: number;
}
export const PROVE_POOL: readonly Case[] = [
  { you: 30, opp: 50 },
  { you: 60, opp: 70 },
  { you: 80, opp: 60 },
  { you: 50, opp: 50 },
  { you: 45, opp: 75 },
];
export const answer = (c: Case): number => gain(c.you, c.opp);
export const isRight = (c: Case, v: number, tol = 0.26): boolean => Math.abs(v - answer(c)) <= tol + 1e-9;

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
