import type { Rng } from "../../core/Rng";

/**
 * A first price auction. You win if your bid is above the rival's, and pay your bid. Your pay is your value minus your bid.
 * A strategy turns a value into a bid. A direct mechanism asks for your value and then places that same bid for you.
 */
export class Bidder {
  readonly k: number;

  constructor(k: number) {
    this.k = k;
  }

  /** The bid the strategy places for a value. */
  bid(value: number): number {
    return this.k * value;
  }

  /** Your pay against a rival bid. Ties lose. */
  pay(value: number, bid: number, rival: number): number {
    return bid > rival ? value - bid : 0;
  }

  /** Playing the strategy yourself, or telling the truth to the mechanism that applies it. */
  direct(value: number, rival: number): number {
    return this.pay(value, this.bid(value), rival);
  }
}

export const HALF = new Bidder(0.5);

export interface Round {
  value: number;
  rival: number;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { value: 8, rival: 3 },
  { value: 10, rival: 4 },
  { value: 6, rival: 5 },
  { value: 9, rival: 2 },
];

export const SEE_MAX = 12;

export interface Case {
  k: number;
  word: string;
  value: number;
}
export const PROVE_POOL: readonly Case[] = [
  { k: 2 / 3, word: "two thirds", value: 9 },
  { k: 3 / 4, word: "three quarters", value: 8 },
  { k: 4 / 5, word: "four fifths", value: 10 },
];

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}

export const machineBid = (c: Case): number => new Bidder(c.k).bid(c.value);
export const isRight = (c: Case, v: number, tol = 0.25): boolean => Math.abs(v - machineBid(c)) <= tol + 1e-9;
