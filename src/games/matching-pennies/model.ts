import { Rng } from "../../core/Rng";

export type Side = 0 | 1;

/**
 * A pattern reader. It looks at the last one and two moves of the player,
 * adds the human habit of switching too often, and bets on the likelier side.
 * Against a patterned player it wins. Against a fair coin it cannot beat half.
 */
export class PatternPredictor {
  readonly history: Side[] = [];
  private readonly one = new Map<string, [number, number]>();
  private readonly two = new Map<string, [number, number]>();
  private readonly rng: Rng;

  constructor(rng: Rng) {
    this.rng = rng;
  }

  predict(): Side {
    const n = this.history.length;
    const last = n > 0 ? this.history[n - 1]! : null;
    const c1 = n >= 1 ? this.one.get(String(last)) : undefined;
    const c2 = n >= 2 ? this.two.get(`${this.history[n - 2]}${last}`) : undefined;
    const score: [number, number] = [0, 0];
    for (const s of [0, 1] as const) {
      score[s] = 2 * (c2?.[s] ?? 0) + (c1?.[s] ?? 0) + (last !== null && s !== last ? 0.75 : 0);
    }
    if (score[0] === score[1]) return this.rng.chance(0.5) ? 0 : 1;
    return score[0] > score[1] ? 0 : 1;
  }

  observe(move: Side): void {
    const n = this.history.length;
    if (n >= 1) {
      const k = String(this.history[n - 1]);
      const c = this.one.get(k) ?? [0, 0];
      c[move]++;
      this.one.set(k, c);
    }
    if (n >= 2) {
      const k = `${this.history[n - 2]}${this.history[n - 1]}`;
      const c = this.two.get(k) ?? [0, 0];
      c[move]++;
      this.two.set(k, c);
    }
    this.history.push(move);
  }
}

export interface PenniesStats {
  rounds: number;
  /** Share of your moves that were Left. */
  pLeft: number;
  /** Share of rounds the predictor guessed correctly. */
  caught: number;
  caughtCount: number;
  /** After a Left, how often you played Left again. */
  repeatAfterLeft: number;
  /** After a Right, how often you played Right again. */
  repeatAfterRight: number;
}

export function statsOf(moves: readonly Side[], guesses: readonly Side[]): PenniesStats {
  const n = moves.length;
  let left = 0;
  let caught = 0;
  let afterL = 0;
  let repL = 0;
  let afterR = 0;
  let repR = 0;
  for (let i = 0; i < n; i++) {
    if (moves[i] === 0) left++;
    if (moves[i] === guesses[i]) caught++;
    if (i > 0) {
      if (moves[i - 1] === 0) {
        afterL++;
        if (moves[i] === 0) repL++;
      } else {
        afterR++;
        if (moves[i] === 1) repR++;
      }
    }
  }
  return {
    rounds: n,
    pLeft: n ? left / n : 0.5,
    caught: n ? caught / n : 0.5,
    caughtCount: caught,
    repeatAfterLeft: afterL ? repL / afterL : 0.5,
    repeatAfterRight: afterR ? repR / afterR : 0.5,
  };
}

/** Your expected score per round against an opponent who always bets on your likelier side. */
export const expectedScore = (pLeft: number): number => -Math.abs(2 * pLeft - 1);

/** Running accuracy of the predictor against a fair coin, for the Prove animation. */
export function randomRun(rounds: number, seed: number): number[] {
  const rng = new Rng(seed);
  const predictor = new PatternPredictor(rng.fork("predictor"));
  const coin = rng.fork("coin");
  const out: number[] = [];
  let caught = 0;
  for (let i = 0; i < rounds; i++) {
    const guess = predictor.predict();
    const move: Side = coin.chance(0.5) ? 0 : 1;
    if (guess === move) caught++;
    predictor.observe(move);
    out.push(caught / (i + 1));
  }
  return out;
}
