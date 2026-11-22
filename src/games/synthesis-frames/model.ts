import type { Rng } from "../../core/Rng";

/**
 * A seller is strong or weak. A strong seller always says "Premium". How a weak seller behaves depends on how far it reasons:
 * a naive one says it always (bluff 1), an honest one never (bluff 0), a clever one bluffs half the time (bluff 0.5).
 * A buyer who hears "Premium" must update on the prior and on the seller's level.
 */
export const posterior = (prior: number, bluff: number): number => prior / (prior + (1 - prior) * bluff);

export interface Seller {
  bluff: number;
  desc: string;
  short: string;
}
export const SELLERS: Record<string, Seller> = {
  naive: { bluff: 1, desc: "says it every time", short: "always" },
  honest: { bluff: 0, desc: "says it only if strong", short: "honest" },
  clever: { bluff: 0.5, desc: "bluffs half the time when weak", short: "bluffer" },
};

export const PRIZE = 6;
export const PASS = 3;
export interface Round {
  prior: number;
  seller: string;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { prior: 0.3, seller: "naive" },
  { prior: 0.3, seller: "honest" },
  { prior: 0.6, seller: "clever" },
  { prior: 0.3, seller: "clever" },
];
export const buyValue = (r: Round): number => PRIZE * posterior(r.prior, SELLERS[r.seller]!.bluff);

export const SEE_PRIOR = 0.5;
export const SEE_ORDER: readonly string[] = ["naive", "honest", "clever"];

export interface Case {
  prior: number;
  bluff: number;
}
export const PROVE_POOL: readonly Case[] = [
  { prior: 0.4, bluff: 0.5 },
  { prior: 0.5, bluff: 0.5 },
  { prior: 0.2, bluff: 0 },
  { prior: 0.5, bluff: 1 },
  { prior: 0.6, bluff: 0.25 },
];
export const percent = (c: Case): number => Math.round(posterior(c.prior, c.bluff) * 100);
export const isRight = (c: Case, v: number, tol = 3): boolean => Math.abs(v - percent(c)) <= tol + 1e-9;

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
