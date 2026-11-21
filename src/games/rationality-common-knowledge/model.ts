/**
 * The guessing contest: everyone picks a number from 0 to 100 and the guess closest to p times
 * the average wins. Each extra step of "I think that they think" multiplies the crowd's guess by p.
 * If everyone is rational and everyone knows that everyone knows it, the steps never stop and the
 * answer is 0.
 */
export class Contest {
  readonly p: number;

  constructor(p = 2 / 3) {
    this.p = p;
  }

  /** What the crowd guesses after thinking k steps from a starting guess. */
  crowd(start: number, k: number): number {
    return start * this.p ** k;
  }

  /** The best guess against a large crowd that will say q. */
  best(q: number): number {
    return this.p * q;
  }

  /** The ladder of guesses: start, start p, start p squared, and so on. */
  ladder(start: number, steps: number): number[] {
    return Array.from({ length: steps + 1 }, (_, k) => this.crowd(start, k));
  }
}

export const FEEL_ROUNDS: readonly { k: number; label: string }[] = [
  { k: 0, label: "Everyone guesses blind" },
  { k: 1, label: "Everyone thought one step" },
  { k: 3, label: "Everyone thought three steps" },
];

export const FEEL_START = 50;

export interface ContestPuzzle {
  p: number;
  start: number;
  /** Steps of thinking the crowd has done. */
  k: number;
}

export const PUZZLES: readonly ContestPuzzle[] = [
  { p: 1 / 2, start: 60, k: 1 },
  { p: 3 / 4, start: 80, k: 2 },
];

export const bestFor = (z: ContestPuzzle): number => new Contest(z.p).best(new Contest(z.p).crowd(z.start, z.k));

export const TOLERANCE = 3.5;
