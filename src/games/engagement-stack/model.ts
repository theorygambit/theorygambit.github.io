import type { Rng } from "../../core/Rng";

/**
 * A product that stacks n layers of engagement theory (ratings, difficulty tuning, offers, and so on).
 * Each layer adds e of engagement and every pair of layers adds s more because they feed each other.
 * Strain on the player grows with the square of the layers, because they all push at once.
 */
export class Stack {
  readonly e: number;
  readonly s: number;
  readonly q: number;

  constructor(e: number, s: number, q: number) {
    this.e = e;
    this.s = s;
    this.q = q;
  }

  engagement(n: number): number {
    return this.e * n + (this.s * n * (n - 1)) / 2;
  }

  strain(n: number): number {
    return this.q * n * n;
  }

  /** What is left once the strain is paid for. */
  net(n: number): number {
    return this.engagement(n) - this.strain(n);
  }

  /** The number of layers, from 0 to max, with the most net. */
  best(max: number): number {
    let b = 0;
    for (let n = 1; n <= max; n++) if (this.net(n) > this.net(b)) b = n;
    return b;
  }
}

export const FEEL = new Stack(10, 4, 4);
export const FEEL_ROUNDS = 5;
export const MAX_LAYERS = 5;
export const PROVE_MAX = 6;

export const PROVE_POOL: readonly Stack[] = [new Stack(12, 2, 3), new Stack(9, 4, 5), new Stack(20, 2, 3), new Stack(10, 2, 2.5)];

export function answer(s: Stack): number {
  return s.best(PROVE_MAX);
}

export function proveSet(rng: Rng): Stack[] {
  return rng.shuffle(PROVE_POOL).slice(0, 2);
}
