import type { Rng } from "../../core/Rng";

/** Hedge: after each round every option's weight is multiplied by (1 - eps x loss). Play in proportion to the weights. */
export const update = (w: number, eps: number, loss: number): number => w * (1 - eps * loss);

export const normalise = (w: readonly number[]): number[] => {
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
};

export interface Round {
  weights: [number, number, number];
  next: [number, number, number];
}
/** Weights are shares. `next` is what each option pays next. */
export const FEEL_ROUNDS: readonly Round[] = [
  { weights: [0.6, 0.3, 0.1], next: [3, 5, 0] },
  { weights: [0.6, 0.3, 0.1], next: [0, 6, 6] },
  { weights: [0.5, 0.4, 0.1], next: [6, 0, 0] },
  { weights: [0.5, 0.3, 0.2], next: [0, 4, 6] },
];
/** Put everything on the heaviest option. */
export const pick = (r: Round): number => r.next[r.weights.indexOf(Math.max(...r.weights))]!;
/** Play in proportion to the weights. */
export const spread = (r: Round): number => r.weights.reduce((s, w, i) => s + w * r.next[i]!, 0);

export const SEE_EPS = 0.5;
export const SEE_LOSSES: readonly (readonly number[])[] = [[0, 1, 1], [1, 0, 1], [0, 1, 0], [0, 1, 1], [0, 0, 1]];
/** The shares after the first k rounds, starting equal. */
export function seeShares(k: number): number[] {
  let w = [1, 1, 1];
  for (let t = 0; t < k; t++) w = w.map((x, i) => update(x, SEE_EPS, SEE_LOSSES[t]![i]!));
  return normalise(w);
}

export interface Case {
  w: number;
  eps: number;
  loss: number;
}
export const PROVE_POOL: readonly Case[] = [
  { w: 80, eps: 0.5, loss: 1 },
  { w: 60, eps: 0.25, loss: 1 },
  { w: 100, eps: 0.5, loss: 0.6 },
  { w: 50, eps: 0.2, loss: 0.5 },
];
export const answer = (c: Case): number => update(c.w, c.eps, c.loss);
export const isRight = (c: Case, v: number, tol = 1.5): boolean => Math.abs(v - answer(c)) <= tol + 1e-9;

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
