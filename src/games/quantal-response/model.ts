import type { Rng } from "../../core/Rng";

/** A noisy chooser. The better of two moves is picked with chance 1 / (1 + e^(-lambda x gap)). Large lambda is nearly perfect. */
export const chance = (lambda: number, gap: number): number => 1 / (1 + Math.exp(-lambda * gap));

export const FEEL_GAPS: readonly number[] = [3, 1, 2, 0.5];
export const SAFE = 3;
export const BET = 4;

export interface Case {
  lambda: number;
  gap: number;
}
export const PROVE_POOL: readonly Case[] = [
  { lambda: 1, gap: 1 },
  { lambda: 2, gap: 1 },
  { lambda: 0.5, gap: 2 },
  { lambda: 1, gap: 3 },
  { lambda: 1, gap: 0 },
];

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
/** The chance in whole percent. */
export const percent = (c: Case): number => Math.round(chance(c.lambda, c.gap) * 100);
export const isRight = (c: Case, v: number, tol = 2): boolean => Math.abs(v - percent(c)) <= tol + 1e-9;
