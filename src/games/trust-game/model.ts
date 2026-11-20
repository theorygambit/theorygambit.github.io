/**
 * You hold `endow` coins and send any part to a stranger. The pot multiplies by `mult`
 * and the stranger alone decides how much of it to send back.
 */
export class Trust {
  readonly mult: number;
  readonly endow: number;

  constructor(mult = 3, endow = 10) {
    this.mult = mult;
    this.endow = endow;
  }

  pot(sent: number): number {
    return sent * this.mult;
  }

  /** Coins that come back when the stranger returns the share r of the pot. */
  back(sent: number, r: number): number {
    return this.pot(sent) * r;
  }

  /** What you end with. */
  final(sent: number, r: number): number {
    return this.endow - sent + this.back(sent, r);
  }

  /** The share of the pot that makes sending exactly worth it. */
  get breakEven(): number {
    return 1 / this.mult;
  }

  pays(r: number): boolean {
    return r > this.breakEven;
  }
}

/** The share of the pot each of four strangers returns. Two are worth trusting and two are not. */
export const RETURN_SHARES: readonly number[] = [0.6, 0, 0.45, 0.2];

/** New multipliers for Prove. A third is not the answer any more. */
export const PROVE_TRUSTS: readonly Trust[] = [new Trust(2), new Trust(4)];
export const PROVE_TOLERANCE = 0.05;
