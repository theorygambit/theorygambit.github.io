import type { Rng } from "../../core/Rng";

/**
 * Fehr-Schmidt utility. You get x and they get y. Being behind costs `alpha` per unit and being ahead costs `beta` per unit.
 */
export class Fair {
  readonly alpha: number;
  readonly beta: number;

  constructor(alpha: number, beta: number) {
    this.alpha = alpha;
    this.beta = beta;
  }

  utility(x: number, y: number): number {
    return x - this.alpha * Math.max(y - x, 0) - this.beta * Math.max(x - y, 0);
  }
}

export const FEEL = new Fair(0.8, 0.4);
export interface Round {
  a: [number, number];
  b: [number, number];
}
export const FEEL_ROUNDS: readonly Round[] = [
  { a: [8, 2], b: [5, 5] },
  { a: [2, 8], b: [3, 3] },
  { a: [6, 4], b: [4, 4] },
  { a: [3, 9], b: [1, 1] },
];
export const felt = (x: number, y: number): number => FEEL.utility(x, y);

export const SEE_ALPHA = 0.5;
export const SEE_POT = 10;
/** Your utility from taking x of 10 when guilt is beta. */
export const seeUtility = (x: number, beta: number): number => new Fair(SEE_ALPHA, beta).utility(x, SEE_POT - x);

export interface Case {
  x: number;
  y: number;
  alpha: number;
  beta: number;
}
export const PROVE_POOL: readonly Case[] = [
  { x: 8, y: 2, alpha: 0.5, beta: 0.5 },
  { x: 2, y: 8, alpha: 0.5, beta: 0.25 },
  { x: 6, y: 2, alpha: 1, beta: 0.25 },
  { x: 1, y: 5, alpha: 0.5, beta: 0.5 },
];
export const value = (c: Case): number => new Fair(c.alpha, c.beta).utility(c.x, c.y);

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
export const isRight = (c: Case, v: number, tol = 0.5): boolean => Math.abs(v - value(c)) <= tol + 1e-9;
