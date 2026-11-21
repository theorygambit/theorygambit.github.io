/**
 * Guess a number from 0 to 100. The winner is closest to p times the average guess. A level 0 player
 * guesses 50. A level k player best replies to level k - 1, so guesses 50 p^k.
 */
export class Beauty {
  readonly p: number;
  /** Share of the crowd at levels 0, 1, 2 and 3. */
  readonly crowd: readonly number[];

  constructor(p: number, crowd: readonly number[] = [0.2, 0.35, 0.3, 0.15]) {
    this.p = p;
    this.crowd = crowd;
  }

  level(k: number): number {
    return 50 * this.p ** k;
  }

  /** The average guess of the crowd. */
  get average(): number {
    return this.crowd.reduce((a, w, k) => a + w * this.level(k), 0);
  }

  /** The number that wins. */
  get target(): number {
    return this.p * this.average;
  }

  /** The perfectly rational answer: only zero is stable. */
  get equilibrium(): number {
    return 0;
  }

  /** How many levels of reasoning it takes to get within `tol` of zero. */
  levelsToZero(tol: number): number {
    let k = 0;
    while (this.level(k) > tol) k++;
    return k;
  }
}

export const FEEL_BEAUTY = new Beauty(2 / 3);

/** New fractions. A level 2 guess is 50 p squared, a whole number here. */
export const PROVE_POOL: readonly Beauty[] = [new Beauty(0.4), new Beauty(0.6), new Beauty(0.8), new Beauty(0.2)];

export const PROVE_TOLERANCE = 2;
