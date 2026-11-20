import type { Rng } from "../../core/Rng";

/** Shops stand on a grid of this step along the street from 0 to 1. */
export const GRID = 0.05;
export const CUSTOMERS = 20;
/** A pick counts when it is this close to the middle customer. */
export const PROVE_TOLERANCE = 0.05;

/**
 * A street with customers at fixed places. Each customer walks to the nearer shop,
 * and a tie splits. With two shops the best reply is to stand just beside the rival
 * on the side with more customers, so both end at the median customer.
 */
export class Street {
  readonly pts: readonly number[];

  constructor(pts: readonly number[]) {
    this.pts = [...pts].sort((a, b) => a - b);
  }

  get n(): number {
    return this.pts.length;
  }

  static uniform(n = CUSTOMERS): Street {
    return new Street(Array.from({ length: n }, (_, i) => (i + 0.5) / n));
  }

  /** Most customers crowd one third of the street, a few are spread out. The median is well off centre. */
  static skewed(rng: Rng, side: "left" | "right", n = CUSTOMERS): Street {
    for (let guard = 0; guard < 200; guard++) {
      const crowd = Math.round(n * 0.7);
      const width = rng.range(0.26, 0.34);
      const start = rng.range(0, 0.2);
      const pts: number[] = [];
      for (let i = 0; i < crowd; i++) pts.push(Math.round((start + width * ((i + rng.next()) / crowd)) * 1000) / 1000);
      for (let i = crowd; i < n; i++) pts.push(Math.round(rng.next() * 1000) / 1000);
      const s = new Street(side === "left" ? pts : pts.map((p) => 1 - p));
      if (Math.abs(s.median() - 0.5) >= 0.12) return s;
    }
    return new Street(Array.from({ length: n }, (_, i) => (side === "left" ? 0.05 + (0.3 * i) / n : 0.95 - (0.3 * i) / n)));
  }

  /** Customers (a tie counts half) that prefer a shop at `a` over a rival at `b`. */
  held(a: number, b: number): number {
    let s = 0;
    for (const p of this.pts) {
      const da = Math.abs(p - a);
      const db = Math.abs(p - b);
      if (da < db - 1e-9) s += 1;
      else if (Math.abs(da - db) <= 1e-9) s += 0.5;
    }
    return s;
  }

  share(a: number, b: number): number {
    return this.held(a, b) / this.n;
  }

  /** Middle customer: half of the street is on each side. */
  median(): number {
    const h = this.n / 2;
    return this.n % 2 ? this.pts[(this.n - 1) / 2]! : (this.pts[h - 1]! + this.pts[h]!) / 2;
  }

  positions(step = GRID): number[] {
    const out: number[] = [];
    for (let i = 0; i <= Math.round(1 / step); i++) out.push(Math.round(i * step * 1000) / 1000);
    return out;
  }

  /** The grid position that holds most customers against a rival at b. Ties go to the one nearest the median. */
  bestReply(b: number, step = GRID): number {
    const m = this.median();
    let best = 0;
    let bh = -1;
    for (const a of this.positions(step)) {
      const h = this.held(a, b);
      if (h > bh + 1e-9 || (Math.abs(h - bh) <= 1e-9 && Math.abs(a - m) < Math.abs(best - m))) {
        bh = h;
        best = a;
      }
    }
    return best;
  }

  /** Move to the best reply only if it holds strictly more customers, else stay. */
  move(a: number, b: number, step = GRID): number {
    const r = this.bestReply(b, step);
    return this.held(r, b) > this.held(a, b) + 1e-9 ? r : a;
  }

  /** True when neither shop can hold more customers by moving on the grid. */
  settled(a: number, b: number, step = GRID): boolean {
    return this.move(a, b, step) === a && this.move(b, a, step) === b;
  }

  below(x: number): number {
    return this.pts.filter((p) => p < x - 1e-9).length;
  }

  above(x: number): number {
    return this.pts.filter((p) => p > x + 1e-9).length;
  }
}

/** Where the Feel rival starts, and where the See shops start. */
export const FEEL_START = 0.2;
export const SEE_START = { you: 0.1, they: 0.3 } as const;

export class StreetCase {
  readonly street: Street;
  readonly median: number;

  constructor(street: Street) {
    this.street = street;
    this.median = street.median();
  }

  accepts(x: number): boolean {
    return Math.abs(x - this.median) <= PROVE_TOLERANCE + 1e-9;
  }
}

/** Two crowds on opposite sides of the street, so their middles differ and neither is the centre. */
export function proveSet(rng: Rng): StreetCase[] {
  const first = rng.chance(0.5) ? "left" : "right";
  const second = first === "left" ? "right" : "left";
  return [new StreetCase(Street.skewed(rng, first)), new StreetCase(Street.skewed(rng, second))];
}
