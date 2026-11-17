export type Hunt = "stag" | "hare";

/**
 * Stag pays `stag` only if the partner also hunts stag, and nothing otherwise.
 * Hare pays `hare` for sure. With belief p that the partner hunts stag,
 * stag is worth stag*p and hare is worth hare, so they cross at p = hare/stag.
 */
export class StagHunt {
  readonly stag: number;
  readonly hare: number;

  constructor(stag = 3, hare = 2) {
    this.stag = stag;
    this.hare = hare;
  }

  evStag(p: number): number {
    return this.stag * p;
  }

  evHare(): number {
    return this.hare;
  }

  /** The belief at which you are indifferent. */
  get threshold(): number {
    return this.hare / this.stag;
  }

  best(p: number): Hunt {
    return this.evStag(p) > this.evHare() ? "stag" : "hare";
  }

  payoff(you: Hunt, them: Hunt): number {
    if (you === "hare") return this.hare;
    return them === "stag" ? this.stag : 0;
  }
}

/** Five partners with different track records, shuffled by the caller. Each is a chance of hunting stag. */
export const PARTNER_BELIEFS: readonly number[] = [0.9, 0.2, 0.7, 0.5, 0.6];

/** Prove puzzles with different payoffs, so the threshold has to be worked out, not remembered. */
export const PROVE_GAMES: readonly StagHunt[] = [new StagHunt(3, 2.4), new StagHunt(4, 1.6)];

export const PROVE_TOLERANCE = 0.07;
