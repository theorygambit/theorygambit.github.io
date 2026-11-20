/** Utility is the square root of money: each extra coin is worth less than the one before. */
export const utility = (money: number): number => Math.sqrt(Math.max(0, money));
export const money = (u: number): number => u * u;

export class Lottery {
  readonly hi: number;
  readonly lo: number;
  readonly p: number;

  constructor(hi: number, lo: number, p: number) {
    this.hi = hi;
    this.lo = lo;
    this.p = p;
  }

  /** Average money. */
  get ev(): number {
    return this.p * this.hi + (1 - this.p) * this.lo;
  }

  /** Probability weighted utility. */
  get eu(): number {
    return this.p * utility(this.hi) + (1 - this.p) * utility(this.lo);
  }

  /** The sure amount that is worth exactly as much as the gamble. */
  get certainty(): number {
    return money(this.eu);
  }

  /** Does a person with this utility take the sure amount over the gamble? */
  prefersSure(sure: number): boolean {
    return utility(sure) > this.eu;
  }
}

/** Feel: the same gamble against four sure amounts. The average money always favours the gamble except at the top. */
export const FEEL_GAMBLE = new Lottery(100, 0, 0.5);
export const FEEL_SURES: readonly number[] = [20, 30, 40, 45];

/** Prove: new gambles. Tolerance is a share of the top prize. */
export const PROVE_GAMBLES: readonly Lottery[] = [new Lottery(64, 0, 0.5), new Lottery(100, 0, 0.25)];
export const PROVE_TOLERANCE = 0.04;
