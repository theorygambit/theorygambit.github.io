/**
 * A smaller reward S at delay t, or a larger reward L a further `gap` weeks on.
 * A hyperbolic discounter values an amount A at delay d as A / (1 + k d).
 */
export class Offer {
  readonly S: number;
  readonly L: number;
  readonly gap: number;
  readonly k: number;

  constructor(S: number, L: number, gap: number, k: number) {
    this.S = S;
    this.L = L;
    this.gap = gap;
    this.k = k;
  }

  hyper(amount: number, delay: number): number {
    return amount / (1 + this.k * delay);
  }

  /** Present value of the sooner reward when it arrives at week t. */
  sooner(t: number): number {
    return this.hyper(this.S, t);
  }

  /** Present value of the later reward when the sooner one arrives at week t. */
  later(t: number): number {
    return this.hyper(this.L, t + this.gap);
  }

  prefersSooner(t: number): boolean {
    return this.sooner(t) > this.later(t);
  }

  /** The delay at which the preference flips from sooner to later: t* = S g / (L - S) - 1 / k. */
  get flip(): number {
    return (this.S * this.gap) / (this.L - this.S) - 1 / this.k;
  }

  /** A steady exponential discounter with factor d per week never flips. */
  expPrefersSooner(t: number, d = 0.9): boolean {
    return this.S * d ** t > this.L * d ** (t + this.gap);
  }
}

export interface Pair {
  offer: Offer;
  t: number;
}

/** Two near choices and two far choices, with the same gap of weeks between sooner and later. */
export const FEEL_PAIRS: readonly Pair[] = [
  { offer: new Offer(5, 8, 4, 0.5), t: 0 },
  { offer: new Offer(5, 8, 4, 0.5), t: 12 },
  { offer: new Offer(4, 7, 3, 0.5), t: 0 },
  { offer: new Offer(4, 7, 3, 0.5), t: 12 },
];

export const SEE_OFFER = new Offer(5, 8, 4, 0.5);

/** New offers for Prove. Each flips at a different delay. */
export const PROVE_OFFERS: readonly Offer[] = [new Offer(6, 9, 3, 0.4), new Offer(6, 8, 4, 0.3)];
export const MAX_WEEKS = 16;
export const PROVE_TOLERANCE = 0.9;
