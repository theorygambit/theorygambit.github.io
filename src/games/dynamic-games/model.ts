import type { Rng } from "../../core/Rng";

export interface PondStep {
  /** What you actually took. */
  took: number;
  /** What the rival actually took. */
  rival: number;
  /** What was left in the pond. */
  left: number;
  /** The pond after it grows back. */
  next: number;
}

/**
 * A shared pond. Stock S, capacity K, growth g. You harvest h, the rival takes a fixed r
 * (or what is left), and what remains grows: S' = min(K, g (S - h - r)).
 * Today's choice changes tomorrow's state.
 */
export class Pond {
  readonly K: number;
  readonly g: number;
  readonly r: number;

  constructor(K = 10, g = 2, r = 2) {
    this.K = K;
    this.g = g;
    this.r = r;
  }

  step(S: number, h: number): PondStep {
    const took = Math.max(0, Math.min(h, S));
    const rival = Math.min(this.r, S - took);
    const left = Math.max(0, S - took - rival);
    return { took, rival, left, next: Math.min(this.K, this.g * left) };
  }

  /** The pond after one period from stock S if you take h. */
  next(S: number, h: number): number {
    return this.step(S, h).next;
  }

  /** The most you can take every period while the pond still refills to capacity. */
  get yield(): number {
    return Math.max(0, this.K - this.K / this.g - this.r);
  }

  /** Best total over `periods` periods starting from stock S, harvesting whole units (backward induction). */
  best(S: number, periods: number): number {
    const memo = new Map<string, number>();
    const go = (s: number, n: number): number => {
      if (n === 0) return 0;
      const key = `${Math.round(s * 1000)}|${n}`;
      const hit = memo.get(key);
      if (hit !== undefined) return hit;
      let top = 0;
      for (let h = 0; h <= Math.floor(s + 1e-9); h++) top = Math.max(top, h + go(this.next(s, h), n - 1));
      memo.set(key, top);
      return top;
    };
    return go(S, periods);
  }
}

export const FEEL_POND = new Pond(10, 2, 2);
export const FEEL_PERIODS = 5;

/** Prove ponds. Their steady yields (2, 6, 5, 6, 4) all differ from the Feel yield (3) by at least 1. */
export const PROVE_POOL: readonly { K: number; g: number; r: number }[] = [
  { K: 9, g: 1.5, r: 1 },
  { K: 12, g: 3, r: 2 },
  { K: 10, g: 2.5, r: 1 },
  { K: 9, g: 3, r: 0 },
  { K: 12, g: 2, r: 2 },
];

export const PROVE_TOLERANCE = 0.5;

/** Two ponds with different yields. `avoid` is the key of the last pair, so a replay differs. */
export function proveSet(rng: Rng, avoid = ""): { ponds: Pond[]; key: string } {
  for (let tries = 0; tries < 60; tries++) {
    const [a, b] = rng.shuffle(PROVE_POOL);
    const pa = new Pond(a!.K, a!.g, a!.r);
    const pb = new Pond(b!.K, b!.g, b!.r);
    const key = [a, b].map((x) => `${x!.K}/${x!.g}/${x!.r}`).sort().join("|");
    if (Math.abs(pa.yield - pb.yield) >= 1 && key !== avoid) return { ponds: [pa, pb], key };
  }
  return { ponds: [new Pond(12, 3, 2), new Pond(9, 1.5, 1)], key: "12/3/2|9/1.5/1" };
}
