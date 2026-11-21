import type { Rng } from "../../core/Rng";

/** Elo: each result moves a rating by K times how surprising it was. */
export class Elo {
  readonly k: number;

  constructor(k: number) {
    this.k = k;
  }

  /** Chance that a player rated `me` beats one rated `opp`. */
  expected(me: number, opp: number): number {
    return 1 / (1 + Math.pow(10, (opp - me) / 400));
  }

  /** Change in rating for a result s: 1 win, 0 loss, 0.5 draw. */
  delta(me: number, opp: number, s: number): number {
    return this.k * (s - this.expected(me, opp));
  }

  next(me: number, opp: number, s: number): number {
    return me + this.delta(me, opp, s);
  }
}

export const FEEL_ELO = new Elo(32);
export const FEEL_START = 1200;
export const FEEL_OPPONENTS: readonly number[] = [1000, 1200, 1400];
export const FEEL_ROUNDS = 5;

/** Play one match: the result is drawn with the Elo chance of a win. */
export function play(rng: Rng, me: number, opp: number, e = FEEL_ELO): number {
  return rng.chance(e.expected(me, opp)) ? 1 : 0;
}

export interface EloPuzzle {
  you: number;
  opp: number;
  s: number;
  k: number;
}

export const PROVE_POOL: readonly EloPuzzle[] = [
  { you: 1500, opp: 1300, s: 0, k: 24 },
  { you: 1100, opp: 1400, s: 1, k: 32 },
  { you: 1350, opp: 1350, s: 1, k: 20 },
  { you: 1800, opp: 1600, s: 0, k: 16 },
];

export function answer(p: EloPuzzle): number {
  return new Elo(p.k).next(p.you, p.opp, p.s);
}

/** A rating is right when it is within this many points of the true update. */
export const TOLERANCE = 3;

export function isRight(p: EloPuzzle, v: number): boolean {
  return Math.abs(v - answer(p)) <= TOLERANCE;
}

export function proveSet(rng: Rng): EloPuzzle[] {
  return rng.shuffle(PROVE_POOL).slice(0, 2);
}
