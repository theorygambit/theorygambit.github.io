/**
 * A sealed bid first price auction with n bidders whose values are uniform between 0 and 1. In the
 * equilibrium every bidder shades to (n - 1) / n of their value. A bid below that wins too rarely,
 * above it pays too much.
 */
export class FirstPrice {
  readonly n: number;

  constructor(n: number) {
    this.n = n;
  }

  get shade(): number {
    return (this.n - 1) / this.n;
  }

  /** The bid every rival uses for a value v. */
  rivalBid(v: number): number {
    return v * this.shade;
  }

  /** The chance a bid b beats every rival. */
  winChance(b: number): number {
    return Math.min(1, b / this.shade) ** (this.n - 1);
  }

  /** Expected profit of bidding b with value v. */
  profit(b: number, v: number): number {
    return (v - b) * this.winChance(b);
  }

  /** The bid that maximises expected profit, found by search. */
  best(v: number): number {
    let top = 0;
    let at = 0;
    for (let b = 0; b <= v + 1e-9; b += 0.001) {
      const p = this.profit(b, v);
      if (p > top) {
        top = p;
        at = b;
      }
    }
    return Math.round(at * 100) / 100;
  }

  /** What the seller expects to receive on average, in a first price or a second price auction alike. */
  get expectedRevenue(): number {
    return (this.n - 1) / (this.n + 1);
  }

  /** Second price auction: the best bid is the value itself. */
  secondPricePayoff(v: number, rival: number): number {
    return v > rival ? v - rival : 0;
  }
}

export const FEEL_AUCTION = new FirstPrice(2);

export interface Case {
  auction: FirstPrice;
  value: number;
}

export const PROVE_POOL: readonly Case[] = [
  { auction: new FirstPrice(3), value: 0.9 },
  { auction: new FirstPrice(4), value: 0.8 },
  { auction: new FirstPrice(5), value: 0.7 },
  { auction: new FirstPrice(3), value: 0.6 },
];

export const PROVE_TOLERANCE = 0.04;
