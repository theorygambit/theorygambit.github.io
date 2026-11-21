import type { Rng } from "../../core/Rng";

/** Payoffs for [entrant, incumbent]. */
export type Pay = readonly [number, number];

export type Reply = "fight" | "accept";

/**
 * An entry game. The entrant stays out or enters. If it enters, the incumbent fights or accepts.
 * The incumbent can say "I will fight", but that is only believable if fighting is better for the incumbent
 * than accepting once the entrant is in.
 */
export class Entry {
  readonly out: Pay;
  readonly fight: Pay;
  readonly accept: Pay;

  constructor(out: Pay, fight: Pay, accept: Pay) {
    this.out = out;
    this.fight = fight;
    this.accept = accept;
  }

  /** What the incumbent does once the entrant is in: the better of the two for the incumbent. */
  reply(): Reply {
    return this.fight[1] > this.accept[1] ? "fight" : "accept";
  }

  /** Is the threat to fight believable? */
  credible(): boolean {
    return this.reply() === "fight";
  }

  /** What the entrant gets if it enters, given the incumbent's real reply. */
  enterPay(): Pay {
    return this.reply() === "fight" ? this.fight : this.accept;
  }

  /** Should the entrant enter? */
  enters(): boolean {
    return this.enterPay()[0] > this.out[0];
  }

  /** The outcome that survives in every part of the game. */
  outcome(): Pay {
    return this.enters() ? this.enterPay() : this.out;
  }

  /** Staying out with a threat of a fight is a Nash equilibrium whenever fighting would hurt the entrant. It is not subgame perfect unless the threat is believable. */
  nashOutWithThreat(): boolean {
    return this.fight[0] <= this.out[0];
  }
}

export const FEEL_ROUNDS = 4;

export const FEEL_MARKETS: readonly Entry[] = [
  new Entry([2, 10], [0, 2], [5, 6]),
  new Entry([2, 10], [0, 7], [5, 4]),
  new Entry([3, 9], [1, 3], [6, 7]),
  new Entry([3, 9], [0, 8], [7, 5]),
];

export function feelMarkets(rng: Rng): Entry[] {
  return rng.shuffle(FEEL_MARKETS);
}

export const SEE_MARKET = FEEL_MARKETS[0]!;

export const PROVE_CREDIBLE: readonly Entry[] = [new Entry([4, 8], [1, 9], [6, 5]), new Entry([3, 10], [2, 8], [7, 6])];
export const PROVE_EMPTY: readonly Entry[] = [new Entry([5, 9], [1, 3], [8, 6]), new Entry([4, 10], [0, 4], [5, 5])];

/** One market where the threat is believable and one where it is empty, in shuffled order. */
export function proveSet(rng: Rng): Entry[] {
  return rng.shuffle([rng.pick(PROVE_CREDIBLE), rng.pick(PROVE_EMPTY)]);
}
