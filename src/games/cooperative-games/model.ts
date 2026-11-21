/** Players 0, 1, 2. A coalition is a bitmask, so {0,2} is 5. */
export class Coalitions {
  readonly v: readonly number[];

  constructor(v: readonly number[]) {
    this.v = v;
  }

  /** What player p adds when they join the players already present in `before`. */
  marginal(p: number, before: number): number {
    return this.v[before | (1 << p)]! - this.v[before]!;
  }

  static readonly orders: readonly (readonly number[])[] = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];

  /** What each player adds, in one arrival order. */
  gains(order: readonly number[]): number[] {
    const out = [0, 0, 0];
    let present = 0;
    for (const p of order) {
      out[p] = this.marginal(p, present);
      present |= 1 << p;
    }
    return out;
  }

  /** The average of what each adds over all six orders: the Shapley value. */
  shapley(): number[] {
    const sum = [0, 0, 0];
    for (const o of Coalitions.orders) this.gains(o).forEach((g, p) => (sum[p]! += g));
    return sum.map((s) => s / 6);
  }

  get grand(): number {
    return this.v[7]!;
  }
}

/** Index: 0 empty, 1 {0}, 2 {1}, 3 {0,1}, 4 {2}, 5 {0,2}, 6 {1,2}, 7 all. */
export const FEEL_GAME = new Coalitions([0, 0, 0, 60, 0, 60, 0, 90]);

export interface Case {
  game: Coalitions;
  player: number;
}

/** Shapley values here are whole numbers, and differ from Feel (player 0 gets 50). */
export const PROVE_POOL: readonly Case[] = [
  { game: new Coalitions([0, 0, 0, 30, 0, 0, 30, 60]), player: 1 },
  { game: new Coalitions([0, 12, 0, 12, 0, 12, 0, 48]), player: 0 },
  { game: new Coalitions([0, 0, 0, 18, 0, 18, 18, 72]), player: 2 },
  { game: new Coalitions([0, 24, 0, 48, 0, 24, 0, 60]), player: 1 },
];
