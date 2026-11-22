import type { Rng } from "../../core/Rng";

/** Three players A, B, C. Alone B and C earn nothing and A earns `solo`. Coalitions earn ab, ac, bc and abc. */
export class Gain {
  readonly solo: number;
  readonly ab: number;
  readonly ac: number;
  readonly bc: number;
  readonly abc: number;

  constructor(solo: number, ab: number, ac: number, bc: number, abc: number) {
    this.solo = solo;
    this.ab = ab;
    this.ac = ac;
    this.bc = bc;
    this.abc = abc;
  }

  /** What A adds when it joins, in each of the six join orders. */
  orders(): { order: string; add: number }[] {
    return [
      { order: "A B C", add: this.solo },
      { order: "A C B", add: this.solo },
      { order: "B A C", add: this.ab },
      { order: "C A B", add: this.ac },
      { order: "B C A", add: this.abc - this.bc },
      { order: "C B A", add: this.abc - this.bc },
    ];
  }

  /** A's share: its average contribution over the six orders. */
  shapley(): number {
    const o = this.orders();
    return o.reduce((s, x) => s + x.add, 0) / o.length;
  }

  /** What joining last adds. */
  last(): number {
    return this.abc - this.bc;
  }
}

export interface Round {
  game: Gain;
}
export const FEEL_ROUNDS: readonly Gain[] = [new Gain(0, 4, 5, 9, 12), new Gain(2, 4, 5, 7, 8), new Gain(1, 3, 4, 5, 10), new Gain(3, 5, 6, 8, 9)];

export const SEE = new Gain(0, 4, 6, 8, 12);

export const PROVE_POOL: readonly Gain[] = [new Gain(0, 2, 4, 6, 12), new Gain(0, 6, 6, 6, 12), new Gain(0, 4, 5, 3, 9), new Gain(0, 6, 3, 3, 9)];

export function proveSet(rng: Rng): Gain[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
export const isRight = (g: Gain, v: number, tol = 0.26): boolean => Math.abs(v - g.shapley()) <= tol + 1e-9;
