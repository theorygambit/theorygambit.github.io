import type { Rng } from "../../core/Rng";

/** A player with a hidden skill s. The chance of beating a level d falls smoothly as d passes s. */
export class Challenge {
  readonly skill: number;

  constructor(skill: number) {
    this.skill = skill;
  }

  chance(d: number): number {
    return 1 / (1 + Math.exp(d - this.skill));
  }

  /** The level where the chance of winning equals the target. */
  level(target: number): number {
    return this.skill - Math.log(target / (1 - target));
  }

  /** One attempt at level d. */
  attempt(rng: Rng, d: number): boolean {
    return rng.chance(this.chance(d));
  }
}

export const FEEL_SKILL = 5;
export const FEEL_ROUNDS = 6;
export const TARGET = 0.7;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 9;
/** The See thermostat starts hard and moves in steps of this size. */
export const STEP = 1.5;
export const SEE_START = 8;

/** The thermostat: a win nudges the level up a little, a loss nudges it down more, so wins settle at the target. */
export function thermostat(d: number, won: boolean, target = TARGET, k = 1): number {
  const nd = d + k * (won ? 1 - target : -target);
  return Math.min(MAX_LEVEL + 1, Math.max(0, nd));
}

export interface LevelPuzzle {
  skill: number;
  target: number;
}

export const PROVE_POOL: readonly LevelPuzzle[] = [
  { skill: 3, target: 0.7 },
  { skill: 7, target: 0.6 },
  { skill: 8, target: 0.8 },
  { skill: 6, target: 0.5 },
];

export const TOLERANCE = 0.5;

export function answer(p: LevelPuzzle): number {
  return new Challenge(p.skill).level(p.target);
}

export function isRight(p: LevelPuzzle, d: number): boolean {
  return Math.abs(d - answer(p)) <= TOLERANCE;
}

export function proveSet(rng: Rng): LevelPuzzle[] {
  return rng.shuffle(PROVE_POOL).slice(0, 2);
}
