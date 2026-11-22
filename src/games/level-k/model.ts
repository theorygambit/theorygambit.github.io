import type { Rng } from "../../core/Rng";

/** Guess two thirds of the average. Level 0 guesses at random, with average `start`, and each level best responds to the one below. */
export const guess = (start: number, level: number): number => (start * Math.pow(2, level)) / Math.pow(3, level);

/** Pay in Feel: closer to two thirds of the crowd's average is better. */
export const target = (mean: number): number => (2 / 3) * mean;
export const closeness = (g: number, mean: number): number => Math.max(0, 1 - Math.abs(g - target(mean)) / 20);

export interface Round {
  mean: number;
  a: number;
  b: number;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { mean: 50, a: 33, b: 22 },
  { mean: 33, a: 33, b: 22 },
  { mean: 22, a: 22, b: 15 },
  { mean: 60, a: 33, b: 40 },
];

export const SEE_START = 50;
export const SEE_LEVELS = 5;

export interface Case {
  start: number;
  level: number;
}
export const PROVE_POOL: readonly Case[] = [
  { start: 54, level: 2 },
  { start: 81, level: 3 },
  { start: 45, level: 1 },
  { start: 90, level: 2 },
];

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
export const answer = (c: Case): number => guess(c.start, c.level);
export const isRight = (c: Case, v: number, tol = 1.5): boolean => Math.abs(v - answer(c)) <= tol + 1e-9;
