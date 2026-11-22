import type { Rng } from "../../core/Rng";

/**
 * One item, sold by the Vickrey-Clarke-Groves rule. The highest report wins and pays the harm its win does to the others,
 * which is the best value among the rivals. Reporting your true value is then the best you can do.
 */
export class Sale {
  readonly value: number;
  readonly others: readonly number[];

  constructor(value: number, others: readonly number[]) {
    this.value = value;
    this.others = others;
  }

  best(): number {
    return Math.max(...this.others);
  }

  /** What you pay if you report r: the harm to others if you win, nothing if you lose. */
  price(r: number): number {
    return r > this.best() ? this.best() : 0;
  }

  /** Your pay: your true value less the price, when you win. */
  pay(r: number): number {
    return r > this.best() ? this.value - this.best() : 0;
  }

  /** Is truth at least as good as any report? */
  truthIsBest(): boolean {
    for (let r = 0; r <= 12; r += 0.5) if (this.pay(r) > this.pay(this.value) + 1e-9) return false;
    return true;
  }
}

export interface Round {
  value: number;
  other: number;
  lie: number;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { value: 8, other: 5, lie: 4 },
  { value: 4, other: 6, lie: 8 },
  { value: 7, other: 3, lie: 5 },
  { value: 5, other: 9, lie: 3 },
];

export const SEE = new Sale(8, [5]);
export const SEE_MAX = 10;

export const PROVE_POOL: readonly Sale[] = [new Sale(9, [4, 7]), new Sale(6, [9, 2]), new Sale(8, [3, 6]), new Sale(5, [8, 1])];

/** One you win and one you lose. */
export function proveSet(rng: Rng): Sale[] {
  const wins = PROVE_POOL.filter((s) => s.value > s.best());
  const loses = PROVE_POOL.filter((s) => s.value < s.best());
  return rng.shuffle([rng.pick(wins), rng.pick(loses)]);
}

/** What you pay when you report your value. */
export const owed = (s: Sale): number => s.price(s.value);
export const isRight = (s: Sale, v: number, tol = 0.5): boolean => Math.abs(v - owed(s)) <= tol + 1e-9;
