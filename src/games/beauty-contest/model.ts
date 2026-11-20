import type { Rng } from "../../core/Rng";

export const BASE = 50;
export const MAX = 100;

/** Everyone guesses 0 to 100. The target is `factor` times the average. The closest guess wins. */
export class BeautyContest {
  readonly factor: number;

  constructor(factor: number) {
    this.factor = factor;
  }

  /** The guess of someone who reasons k steps from a first guess of 50. */
  levelGuess(k: number): number {
    return BASE * Math.pow(this.factor, k);
  }

  mean(guesses: readonly number[]): number {
    return guesses.reduce((s, g) => s + g, 0) / Math.max(1, guesses.length);
  }

  target(guesses: readonly number[]): number {
    return this.factor * this.mean(guesses);
  }

  /** Index of the closest guess. Lower index wins an exact tie. */
  winner(guesses: readonly number[]): number {
    const t = this.target(guesses);
    let best = 0;
    for (let i = 1; i < guesses.length; i++) if (Math.abs(guesses[i]! - t) < Math.abs(guesses[best]! - t)) best = i;
    return best;
  }
}

export const FEEL_CONTEST = new BeautyContest(2 / 3);

/** Share of the crowd at each reasoning level, per round. The crowd learns: later rounds think further. */
const MIX: readonly (readonly number[])[] = [
  [0.4, 0.4, 0.15, 0.05],
  [0.1, 0.4, 0.4, 0.1],
  [0.05, 0.15, 0.45, 0.35],
];

/** Eleven other players for a round (0, 1 or 2), levels placed evenly through the mix and jittered a little. */
export function crowd(rng: Rng, round: number, f = FEEL_CONTEST, n = 11): number[] {
  const mix = MIX[Math.min(MIX.length - 1, Math.max(0, round))]!;
  const levels: number[] = [];
  let acc = 0;
  mix.forEach((share, k) => {
    acc += share * n;
    while (levels.length < Math.round(acc)) levels.push(k);
  });
  while (levels.length < n) levels.push(mix.length - 1);
  return levels.slice(0, n).map((k) => Math.max(0, Math.min(MAX, Math.round(f.levelGuess(k) + rng.range(-3, 3)))));
}

export interface ContestPuzzle {
  f: number;
  crowdSteps: number;
  /** The winning guess: one step beyond a crowd that has reasoned crowdSteps steps. */
  answer: number;
  label: string;
}

const mk = (f: number, crowdSteps: number, label: string): ContestPuzzle => ({ f, crowdSteps, answer: BASE * Math.pow(f, crowdSteps + 1), label });

const FEEL_WIN = 22;
export const PROVE_POOL: readonly ContestPuzzle[] = [
  mk(3 / 4, 1, "3/4"),
  mk(1 / 2, 1, "1/2"),
  mk(4 / 5, 1, "4/5"),
  mk(3 / 5, 1, "3/5"),
  mk(3 / 4, 2, "3/4"),
  mk(1 / 2, 2, "1/2"),
  mk(4 / 5, 2, "4/5"),
  mk(3 / 5, 2, "3/5"),
].filter((p) => Math.abs(p.answer - FEEL_WIN) > 5 && Math.abs(p.answer - BASE * p.f) > 5);

export const PROVE_TOLERANCE = 2.5;

export function pickPuzzles(pick: <T>(items: readonly T[]) => T): ContestPuzzle[] {
  const a = pick(PROVE_POOL);
  let b = pick(PROVE_POOL);
  let guard = 0;
  while ((b === a || b.f === a.f || Math.abs(b.answer - a.answer) < 6) && guard++ < 80) b = pick(PROVE_POOL);
  return [a, b];
}
