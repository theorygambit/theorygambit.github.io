import { normalCdf, normalInv } from "../../core/math";

export const PIE = 10;

/**
 * A crowd of responders. Each has a private minimum offer, and those minimums
 * are spread like a bell curve around `mu`. The chance that an offer of x is
 * accepted is the share of the crowd whose minimum is at or below x.
 */
export class Crowd {
  readonly name: string;
  readonly mu: number;
  readonly sigma: number;

  constructor(name: string, mu: number, sigma: number) {
    this.name = name;
    this.mu = mu;
    this.sigma = sigma;
  }

  /** Chance an offer of x (what they get) is accepted. */
  accept(x: number): number {
    return normalCdf((x - this.mu) / this.sigma);
  }

  /** What you keep, on average, when you offer x. */
  expected(x: number): number {
    return (PIE - x) * this.accept(x);
  }

  /** The offer that earns the most on average, searched in steps of 0.05. */
  best(): { x: number; e: number } {
    let bx = 0;
    let be = -1;
    for (let x = 0; x <= PIE + 1e-9; x += 0.05) {
      const e = this.expected(x);
      if (e > be) {
        be = e;
        bx = x;
      }
    }
    return { x: Math.round(bx * 100) / 100, e: be };
  }

  /** n responder minimums placed evenly through the crowd, so a short game still shows the shape. */
  thresholds(n: number): number[] {
    return Array.from({ length: n }, (_, i) => this.mu + this.sigma * normalInv((i + 0.5) / n));
  }
}

/** The people of the Feel round. Fair-minded on average, like most real crowds. */
export const FEEL_CROWD = new Crowd("the crowd", 3, 1.3);

/** The textbook prediction: offer the smallest unit, because anything beats nothing. */
export const TEXTBOOK_OFFER = 1;

/** Prove crowds: one far more generous, one far more demanding. */
export const PROVE_CROWDS: readonly Crowd[] = [new Crowd("a generous crowd", 1.5, 0.6), new Crowd("a demanding crowd", 3.8, 1.2)];

/** A pick counts when it earns at least this share of the best possible average. */
export const PROVE_SHARE = 0.94;
