import type { Rng } from "../../core/Rng";

/**
 * An urn of 90 balls: 30 red, and 60 that are black or yellow in an unknown mix. `black` is the number of black balls.
 * Four bets each win a prize: red (A), black (B), red or yellow (C), black or yellow (D).
 */
export type Bet = "A" | "B" | "C" | "D";
export const BET_NAMES: Record<Bet, string> = { A: "red", B: "black", C: "red or yellow", D: "black or yellow" };

export class Urn {
  readonly black: number;

  constructor(black: number) {
    this.black = black;
  }

  chance(b: Bet): number {
    switch (b) {
      case "A": return 30 / 90;
      case "B": return this.black / 90;
      case "C": return (90 - this.black) / 90;
      default: return 60 / 90;
    }
  }

  better(a: Bet, b: Bet): Bet {
    return this.chance(a) >= this.chance(b) ? a : b;
  }
}

/** Known urn: half red. Unknown urn: this chance of the winning colour, shown after the choice. */
export const FEEL_CHANCE: readonly number[] = [0.8, 0.2, 0.5, 0.65];
export const KNOWN = 0.5;
export const PRIZE = 6;

export interface Case {
  pair: "AB" | "CD";
  black: number;
}
export const PROVE_POOL: readonly Case[] = [
  { pair: "AB", black: 20 },
  { pair: "AB", black: 50 },
  { pair: "CD", black: 20 },
  { pair: "CD", black: 50 },
];

export const pairBets = (c: Case): [Bet, Bet] => (c.pair === "AB" ? ["A", "B"] : ["C", "D"]);
/** The better bet's slot, 0 or 1. */
export const answer = (c: Case): 0 | 1 => {
  const [x, y] = pairBets(c);
  return new Urn(c.black).better(x, y) === x ? 0 : 1;
};

export function proveSet(rng: Rng): Case[] {
  const ab = PROVE_POOL.filter((c) => c.pair === "AB");
  const cd = PROVE_POOL.filter((c) => c.pair === "CD");
  return rng.shuffle([rng.pick(ab), rng.pick(cd)]);
}
