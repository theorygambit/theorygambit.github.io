import type { Rng } from "../../core/Rng";

/**
 * Finding an equilibrium of an n by n game by brute force means checking every pair of supports: (2^n - 1)^2 pairs.
 * Lemke-Howson instead follows one path, usually short. Nobody knows a method that is fast on every game.
 */
export const brute = (n: number): number => Math.pow(Math.pow(2, n) - 1, 2);
/** Typical length of the path-following search, a few steps per action. */
export const path = (n: number): number => 2 * n;

export interface Round {
  n: number;
}
export const FEEL_ROUNDS: readonly Round[] = [{ n: 2 }, { n: 3 }, { n: 5 }, { n: 6 }];
/** Pay is higher when fewer checks are needed. */
export const pay = (checks: number): number => Math.max(0, Math.min(6, 6 - 1.4 * Math.log10(checks)));

export const SEE_MAX = 10;

export interface Case {
  n: number;
}
export const PROVE_POOL: readonly Case[] = [{ n: 2 }, { n: 3 }, { n: 4 }];
export const answer = (c: Case): number => brute(c.n);
/** A tempting wrong count: one per action pair. */
export const decoy = (c: Case): number => c.n * c.n;

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
