import type { Rng } from "../../core/Rng";

/** Items that fit the time of day. Each peaks at an hour and fades around it. */
export const ITEMS = [
  { name: "Coffee", peak: 8 },
  { name: "Lunch", peak: 13 },
  { name: "Film", peak: 21 },
] as const;
export const fit = (item: number, hour: number): number => Math.exp(-Math.pow((hour - ITEMS[item]!.peak) / 3, 2));

export interface Round {
  phone: number;
  server: number;
  delay: number;
}
/** The phone knows the moment but has a small model. The server has the big model but a stale moment and a delay. */
export const FEEL_ROUNDS: readonly Round[] = [
  { phone: 5, server: 6, delay: 3 },
  { phone: 2, server: 6, delay: 1 },
  { phone: 6, server: 5, delay: 2 },
  { phone: 3, server: 6, delay: 0.5 },
];
export const phonePay = (r: Round): number => r.phone;
export const serverPay = (r: Round): number => r.server - r.delay;

export const SEE_ITEMS = [0, 2];

export interface Case {
  hour: number;
  a: number;
  b: number;
}
export const PROVE_POOL: readonly Case[] = [
  { hour: 10, a: 0, b: 1 },
  { hour: 12, a: 0, b: 1 },
  { hour: 19, a: 1, b: 2 },
  { hour: 23, a: 0, b: 2 },
  { hour: 16, a: 1, b: 2 },
];
export const answer = (c: Case): 0 | 1 => (fit(c.a, c.hour) >= fit(c.b, c.hour) ? 0 : 1);

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
