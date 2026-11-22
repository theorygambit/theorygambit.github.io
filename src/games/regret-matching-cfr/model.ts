import type { Rng } from "../../core/Rng";

/** Rock, paper, scissors. Payoff of each action against an opponent mix (rock, paper, scissors). */
export const ACTIONS = ["rock", "paper", "scissors"];
export const value = (opp: readonly number[]): number[] => [opp[2]! - opp[1]!, opp[0]! - opp[2]!, opp[1]! - opp[0]!];

/** Expected payoff of a mix. */
export const ev = (mix: readonly number[], opp: readonly number[]): number => value(opp).reduce((s, v, i) => s + v * mix[i]!, 0);

/** Regret of not having played each action, against the current mix. */
export const regrets = (mix: readonly number[], opp: readonly number[]): number[] => {
  const v = value(opp);
  const e = ev(mix, opp);
  return v.map((x) => x - e);
};

/** Regret matching: play each action in proportion to its positive regret. Even if there is none. */
export const matching = (r: readonly number[]): number[] => {
  const pos = r.map((x) => Math.max(0, x));
  const s = pos.reduce((a, b) => a + b, 0);
  return s > 0 ? pos.map((x) => x / s) : [1 / 3, 1 / 3, 1 / 3];
};

export const EVEN = [1 / 3, 1 / 3, 1 / 3];
export interface Round {
  opp: [number, number, number];
}
export const FEEL_ROUNDS: readonly Round[] = [{ opp: [0.5, 0.3, 0.2] }, { opp: [0.2, 0.2, 0.6] }, { opp: [0.1, 0.7, 0.2] }, { opp: [0.4, 0.1, 0.5] }];
/** Pay: 3 plus three times the expected payoff, so a fair game pays 3. */
export const pay = (mix: readonly number[], opp: readonly number[]): number => Math.max(0, Math.min(6, 3 + 3 * ev(mix, opp)));

export const SEE_OPP = [0.3, 0.3, 0.4];
export const SEE_MIX = [0, 1, 0];

export interface Case {
  r: [number, number, number];
  idx: number;
}
export const PROVE_POOL: readonly Case[] = [
  { r: [4, 0, 2], idx: 0 },
  { r: [3, 1, -2], idx: 1 },
  { r: [-1, 5, 5], idx: 2 },
  { r: [6, 2, -1], idx: 0 },
];
export const percent = (c: Case): number => Math.round(matching(c.r)[c.idx]! * 100);
export const isRight = (c: Case, v: number, tol = 3): boolean => Math.abs(v - percent(c)) <= tol + 1e-9;

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
