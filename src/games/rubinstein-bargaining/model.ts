import type { Rng } from "../../core/Rng";

/**
 * Two rounds of alternating offers over a pot. If the second offer is reached, the pot has shrunk by the factor `delta`
 * and the other side proposes and takes it all. So the responder accepts any offer worth at least what waiting is worth.
 */
export class Offers {
  readonly pot: number;
  readonly delta: number;

  constructor(pot: number, delta: number) {
    this.pot = pot;
    this.delta = delta;
  }

  /** What the responder gets by waiting. */
  wait(): number {
    return this.pot * this.delta;
  }

  accepts(offer: number): boolean {
    return offer >= this.wait() - 1e-9;
  }

  /** What the first proposer keeps with this offer. A refusal leaves them nothing. */
  keep(offer: number): number {
    return this.accepts(offer) ? this.pot - offer : 0;
  }

  /** The most the proposer can keep. */
  best(): number {
    return this.pot - this.wait();
  }
}

export interface Round {
  delta: number;
  a: number;
  b: number;
}
export const FEEL_POT = 12;
export const FEEL_ROUNDS: readonly Round[] = [
  { delta: 0.5, a: 4, b: 6 },
  { delta: 0.25, a: 3, b: 5 },
  { delta: 0.75, a: 6, b: 9 },
  { delta: 0.5, a: 8, b: 6 },
];

export const SEE = new Offers(12, 0.5);

export const PROVE_POOL: readonly Offers[] = [new Offers(20, 0.4), new Offers(10, 0.7), new Offers(15, 0.2), new Offers(16, 0.75)];

export function proveSet(rng: Rng): Offers[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
export const isRight = (g: Offers, v: number, tol = 0.5): boolean => Math.abs(v - g.best()) <= tol + 1e-9;
