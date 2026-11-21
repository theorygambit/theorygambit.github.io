import type { Rng } from "../../core/Rng";

/**
 * A choice made without knowing which of two situations you are in. At X, L pays xL and R pays xR.
 * At Y, L pays yL and R pays yR. Your belief p is the chance you are at X.
 * L is better at X and R is better at Y, so the best move flips at one belief.
 */
export class Belief {
  readonly xL: number;
  readonly xR: number;
  readonly yL: number;
  readonly yR: number;

  constructor(xL: number, xR: number, yL: number, yR: number) {
    this.xL = xL;
    this.xR = xR;
    this.yL = yL;
    this.yR = yR;
  }

  payL(p: number): number {
    return p * this.xL + (1 - p) * this.yL;
  }

  payR(p: number): number {
    return p * this.xR + (1 - p) * this.yR;
  }

  best(p: number): "L" | "R" | "tie" {
    const d = this.payL(p) - this.payR(p);
    return Math.abs(d) < 1e-9 ? "tie" : d > 0 ? "L" : "R";
  }

  /** The belief at which L and R pay the same. */
  threshold(): number {
    return (this.yR - this.yL) / (this.xL - this.xR + (this.yR - this.yL));
  }

  get max(): number {
    return Math.max(this.xL, this.xR, this.yL, this.yR);
  }

  isRight(p: number, tol = 0.04): boolean {
    return Math.abs(p - this.threshold()) <= tol + 1e-9;
  }
}

export const FEEL = new Belief(6, 0, 0, 4);
export const FEEL_BELIEFS: readonly number[] = [0.9, 0.1, 0.7, 0.2, 0.5];
export const FEEL_ROUNDS = FEEL_BELIEFS.length;

export function feelBeliefs(rng: Rng): number[] {
  return rng.shuffle([...FEEL_BELIEFS]);
}

export const PROVE_POOL: readonly Belief[] = [new Belief(8, 2, 0, 3), new Belief(6, 1, 1, 7), new Belief(7, 3, 0, 6)];

export function proveSet(rng: Rng): Belief[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
