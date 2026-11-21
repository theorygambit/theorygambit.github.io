import type { Rng } from "../../core/Rng";

export interface Round {
  /** Cars still offered this round, by quality. */
  onSale: number[];
  /** What buyers offer: they value a car at `m` times its quality and cannot tell which is which. */
  price: number;
}

/**
 * Buyers cannot see quality, so they offer m times the average quality on sale. Owners of better cars
 * keep them. The market shrinks until the price is enough for every car still offered.
 */
export class Lemons {
  readonly qualities: readonly number[];
  readonly m: number;

  constructor(qualities: readonly number[], m = 1.2) {
    this.qualities = qualities;
    this.m = m;
  }

  offer(onSale: readonly number[]): number {
    return (this.m * onSale.reduce((a, b) => a + b, 0)) / onSale.length;
  }

  /** Every round until nothing changes. The last round is the stable market. */
  rounds(): Round[] {
    let on = [...this.qualities].sort((a, b) => a - b);
    const out: Round[] = [];
    for (;;) {
      const price = this.offer(on);
      out.push({ onSale: on, price });
      const stay = on.filter((q) => q <= price);
      if (stay.length === on.length) return out;
      on = stay;
    }
  }

  get finalPrice(): number {
    return this.rounds().at(-1)!.price;
  }
}

export const FEEL_MARKET = new Lemons([2, 3, 4, 5, 6, 7, 8, 9], 1.2);

/** A random market with at least three rounds, so something unravels more than once. */
export function randomMarket(rng: Rng): Lemons {
  for (let tries = 0; tries < 5000; tries++) {
    const q = Array.from({ length: 8 }, () => rng.int(2, 12)).sort((a, b) => a - b);
    const m = rng.pick([1.1, 1.2, 1.3]);
    const g = new Lemons(q, m);
    const r = g.rounds();
    if (r.length >= 3 && new Set(q).size >= 6 && Math.abs(g.finalPrice - FEEL_MARKET.finalPrice) > 0.5) return g;
  }
  throw new Error("no market found");
}

export const PROVE_TOLERANCE = 0.3;
