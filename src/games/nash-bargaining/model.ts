import type { Rng } from "../../core/Rng";

/**
 * Two players share a pot of `total`. If they fail to agree, player 1 gets d1 and player 2 gets d2.
 * The Nash solution picks the split that maximises the product of the two gains over those fallbacks.
 */
export class Pact {
  readonly d1: number;
  readonly d2: number;
  readonly total: number;

  constructor(d1: number, d2: number, total: number) {
    this.d1 = d1;
    this.d2 = d2;
    this.total = total;
  }

  /** Product of gains when player 1 takes x1. Zero outside the range where both gain. */
  product(x1: number): number {
    const a = x1 - this.d1;
    const b = this.total - x1 - this.d2;
    return a > 0 && b > 0 ? a * b : 0;
  }

  /** Player 1's Nash share. */
  nash(): number {
    return this.d1 + (this.total - this.d1 - this.d2) / 2;
  }

  /** Player 2 accepts a split only if it gives them at least their Nash share. */
  accepts(x1: number): boolean {
    return this.total - x1 >= this.total - this.nash() - 1e-9;
  }

  /** Your pay as player 1 when you offer x1. */
  pay(x1: number): number {
    return this.accepts(x1) ? x1 : this.d1;
  }
}

export interface Round {
  game: Pact;
}
export const FEEL_ROUNDS: readonly Pact[] = [new Pact(4, 0, 12), new Pact(0, 4, 12), new Pact(5, 1, 12), new Pact(1, 5, 12)];

export const SEE = new Pact(3, 1, 12);

export const PROVE_POOL: readonly Pact[] = [new Pact(4, 2, 12), new Pact(1, 5, 14), new Pact(6, 0, 14), new Pact(2, 4, 12), new Pact(0, 2, 10)];

export function proveSet(rng: Rng): Pact[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
export const isRight = (g: Pact, v: number, tol = 0.6): boolean => Math.abs(v - g.nash()) <= tol + 1e-9;
