import type { Rng } from "../../core/Rng";

export const COST = 2;
/** A sale happens if the price is at most what the customer would pay. Profit is price less cost. */
export const profit = (price: number, wtp: number): number => (price <= wtp ? price - COST : 0);

export interface Round {
  wtp: number;
  a: number;
  b: number;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { wtp: 5, a: 4, b: 7 },
  { wtp: 9, a: 4, b: 8 },
  { wtp: 3, a: 3, b: 6 },
  { wtp: 8, a: 6, b: 9 },
];

/** One price for everyone, with willingness to pay spread evenly from 2 to 10. */
export const crowdProfit = (price: number): number => (price < COST || price > 10 ? 0 : ((price - COST) * (10 - price)) / 8);
export const BEST_PRICE = 6;

export interface Case {
  wtps: number[];
  price: number;
}
export const PROVE_POOL: readonly Case[] = [
  { wtps: [3, 5, 8, 9], price: 6 },
  { wtps: [3, 5, 8, 9], price: 4 },
  { wtps: [4, 4, 7, 10], price: 7 },
  { wtps: [2, 6, 6, 9], price: 5 },
  { wtps: [5, 6, 9, 10], price: 9 },
];
export const answer = (c: Case): number => c.wtps.reduce((s, w) => s + profit(c.price, w), 0);
export const isRight = (c: Case, v: number, tol = 0.5): boolean => Math.abs(v - answer(c)) <= tol + 1e-9;

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
