import type { Rng } from "../../core/Rng";

/**
 * Desirability is how often others pick someone, on a scale of 0 to 100.
 * Asking someone far above you rarely works. Asking someone far below wastes the chance.
 */
export const accept = (you: number, them: number): number => Math.max(0, Math.min(1, 1 - Math.max(0, them - you) / 30));
/** Pay: what they are worth to you, times the chance they say yes. */
export const value = (you: number, them: number): number => 6 * (them / 100) * accept(you, them);

export interface Round {
  you: number;
  a: number;
  b: number;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { you: 40, a: 40, b: 70 },
  { you: 60, a: 50, b: 80 },
  { you: 70, a: 90, b: 70 },
  { you: 30, a: 50, b: 30 },
];

export const SEE_YOU = 50;

export interface Case {
  you: number;
  them: number;
}
export const PROVE_POOL: readonly Case[] = [
  { you: 50, them: 65 },
  { you: 40, them: 70 },
  { you: 60, them: 69 },
  { you: 30, them: 45 },
  { you: 70, them: 64 },
];
/** The chance of a yes in whole percent. */
export const percent = (c: Case): number => Math.round(accept(c.you, c.them) * 100);
export const isRight = (c: Case, v: number, tol = 3): boolean => Math.abs(v - percent(c)) <= tol + 1e-9;

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
