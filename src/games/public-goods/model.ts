import type { Rng } from "../../core/Rng";

export const ENDOWMENT = 10;

/** n players each hold 10 tokens. Tokens put in the pot are multiplied by r and shared equally. */
export class Pot {
  readonly n: number;
  readonly r: number;

  constructor(n = 4, r = 1.6) {
    this.n = n;
    this.r = r;
  }

  /** What one token in the pot returns to you. */
  get perToken(): number {
    return this.r / this.n;
  }

  /** What one token in the pot costs you, net. Negative means giving pays you. */
  get netCost(): number {
    return 1 - this.perToken;
  }

  payoff(mine: number, othersTotal: number): number {
    return ENDOWMENT - mine + (this.r * (mine + othersTotal)) / this.n;
  }

  /** Giving more is individually worthwhile only when the multiplier beats the group size. */
  givingPays(): boolean {
    return this.r > this.n;
  }

  /** Total of everyone's payoffs when the group puts in `total` tokens. */
  groupTotal(total: number): number {
    return this.n * ENDOWMENT - total + this.r * total;
  }
}

export const FEEL_POT = new Pot(4, 2);

/** Three other players, each giving somewhere in the middle. */
export function othersGive(rng: Rng): number[] {
  return [0, 1, 2].map(() => rng.int(3, 8));
}

/** Prove: different group sizes, so the break even multiplier differs from Feel (4). */
export const PROVE_SIZES: readonly number[] = [3, 5, 6, 7];

export const MULT_MIN = 1;
export const MULT_MAX = 8;
