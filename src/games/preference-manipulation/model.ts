import type { Rng } from "../../core/Rng";

export interface Option {
  name: string;
  /** Lower is better. */
  price: number;
  /** Higher is better. */
  quality: number;
}

/** a beats b if it is no worse on both and better on one. */
export function dominates(a: Option, b: Option): boolean {
  return a.price <= b.price && a.quality >= b.quality && (a.price < b.price || a.quality > b.quality);
}

/** Who beats this option outright. */
export function beatenBy(set: readonly Option[], o: Option): Option[] {
  return set.filter((x) => x !== o && dominates(x, o));
}

/**
 * The decoy is dominated by exactly one other option and by none of the rest. It is never worth picking,
 * yet it makes the option that beats it look better.
 */
export function decoy(set: readonly Option[]): Option | null {
  const found = set.filter((o) => beatenBy(set, o).length === 1);
  return found.length === 1 ? found[0]! : null;
}

/** Cheap and modest A, pricey and better B, and a decoy D that only B beats. */
export function triple(rng: Rng): Option[] {
  const pa = rng.int(2, 4);
  const qa = rng.int(3, 5);
  const pb = pa + rng.int(3, 4);
  const qb = qa + rng.int(3, 4);
  const d: Option = { name: "D", price: pb + rng.int(1, 2), quality: qb - rng.int(1, 2) };
  const set = [{ name: "A", price: pa, quality: qa }, { name: "B", price: pb, quality: qb }, d];
  return rng.shuffle(set);
}

export const FEEL_PAIR: readonly Option[] = [{ name: "A", price: 3, quality: 4 }, { name: "B", price: 7, quality: 8 }];
export const FEEL_DECOY: Option = { name: "D", price: 8, quality: 7 };
