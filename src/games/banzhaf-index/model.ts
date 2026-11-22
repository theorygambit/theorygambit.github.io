import type { Rng } from "../../core/Rng";

/** A voting body. Each seat has a weight, and a motion passes when the weight in favour reaches the quota. */
export class Council {
  readonly w: readonly number[];
  readonly quota: number;

  constructor(w: readonly number[], quota: number) {
    this.w = w;
    this.quota = quota;
  }

  /** Every group of the other seats, as the list of seat numbers. */
  groups(seat: number): number[][] {
    const rest = this.w.map((_, i) => i).filter((i) => i !== seat);
    const out: number[][] = [];
    for (let m = 0; m < 1 << rest.length; m++) out.push(rest.filter((_, k) => (m >> k) & 1));
    return out;
  }

  sum(g: readonly number[]): number {
    return g.reduce((s, i) => s + this.w[i]!, 0);
  }

  /** The seat tips the group from losing to winning. */
  swings(seat: number, g: readonly number[]): boolean {
    const s = this.sum(g);
    return s < this.quota && s + this.w[seat]! >= this.quota;
  }

  /** How many groups of the others the seat tips. */
  count(seat: number): number {
    return this.groups(seat).filter((g) => this.swings(seat, g)).length;
  }
}

export interface Round {
  w: number[];
  q: number;
  a: number;
  b: number;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { w: [4, 2, 1], q: 4, a: 0, b: 1 },
  { w: [3, 2, 2], q: 4, a: 0, b: 1 },
  { w: [3, 2, 1], q: 4, a: 1, b: 0 },
  { w: [4, 3, 2, 1], q: 6, a: 3, b: 0 },
];

export const SEE = new Council([3, 2, 2], 4);

export interface Case {
  c: Council;
  seat: number;
}
export const PROVE_POOL: readonly Case[] = [
  { c: new Council([5, 3, 2], 6), seat: 0 },
  { c: new Council([3, 3, 2], 5), seat: 0 },
  { c: new Council([4, 3, 2, 1], 6), seat: 1 },
  { c: new Council([2, 2, 1, 1], 4), seat: 2 },
  { c: new Council([5, 2, 1], 5), seat: 1 },
];

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
export const answer = (q: Case): number => q.c.count(q.seat);
export const isRight = (q: Case, v: number, tol = 0.5): boolean => Math.abs(v - answer(q)) <= tol + 1e-9;
