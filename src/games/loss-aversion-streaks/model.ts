/**
 * A streak of s days is worth g per day to its owner. Breaking it loses lambda times that, because
 * losses weigh more than gains. Keeping it costs a day's effort e.
 */
export class Streak {
  readonly g: number;
  readonly lambda: number;

  constructor(g: number, lambda: number) {
    this.g = g;
    this.lambda = lambda;
  }

  /** What a break would feel like with a streak of s days. */
  lossIfBreak(s: number): number {
    return this.lambda * this.g * s;
  }

  /** Keep the streak when the loss beats the effort. */
  keeps(s: number, effort: number): boolean {
    return this.lossIfBreak(s) > effort;
  }

  /** The shortest streak that is worth keeping for an effort e. */
  threshold(effort: number): number {
    return Math.floor(effort / (this.lambda * this.g)) + 1;
  }
}

export const FEEL_STREAK = new Streak(1, 2);

/** Daily efforts in Feel, rising so the streak starts to matter part way through. */
export const FEEL_EFFORTS: readonly number[] = [3, 5, 7, 9, 9];

export interface Case {
  streak: Streak;
  effort: number;
}

/** New values: answers differ from Feel's (4 or 5). */
export const PROVE_POOL: readonly Case[] = [
  { streak: new Streak(2, 2), effort: 10 },
  { streak: new Streak(1, 3), effort: 10 },
  { streak: new Streak(1, 2.5), effort: 13 },
  { streak: new Streak(2, 1.5), effort: 11 },
];

export const MAX_STREAK = 12;
