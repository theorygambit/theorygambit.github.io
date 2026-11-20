import type { Rng } from "../../core/Rng";

export const POT = 10;

/** A responder in the ultimatum game refuses any offer below their minimum. */
export class Responder {
  readonly minimum: number;

  constructor(minimum: number) {
    this.minimum = minimum;
  }

  accepts(offer: number): boolean {
    return offer >= this.minimum;
  }
}

/**
 * What one person gave in two games. In the dictator game the other has no say, so the gift is pure generosity.
 * In the ultimatum game the other can refuse, so part of the offer is fear of refusal.
 */
export class Giver {
  readonly dictator: number;
  readonly ultimatum: number;

  constructor(dictator: number, ultimatum: number) {
    this.dictator = dictator;
    this.ultimatum = ultimatum;
  }

  get generosity(): number {
    return this.dictator;
  }

  /** The extra given only because refusal was possible. Never below zero. */
  get fear(): number {
    return Math.max(0, this.ultimatum - this.dictator);
  }
}

export interface Pair {
  a: Giver;
  b: Giver;
  kinder: "a" | "b";
}

/** The less kind person offers more when refusal is possible, so reading the wrong game gives the wrong answer. */
export function provePairs(rng: Rng): Pair[] {
  const make = (): Pair => {
    const dk = rng.int(2, 5);
    const dl = rng.int(0, dk - 1);
    const uk = dk + rng.int(0, 1);
    const ul = Math.min(7, uk + rng.int(1, 2));
    const kind = new Giver(dk, uk);
    const less = new Giver(dl, ul);
    return rng.chance(0.5) ? { a: kind, b: less, kinder: "a" } : { a: less, b: kind, kinder: "b" };
  };
  const first = make();
  let second = make();
  while (second.kinder === first.kinder && rng.chance(0.7)) second = make();
  return [first, second];
}
