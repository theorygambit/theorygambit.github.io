/** Payoffs are [entrant, incumbent]. */
export type Pay = readonly [number, number];

/**
 * An entrant decides to come in or stay out. If they come in, the incumbent may accommodate or fight.
 * A threat to fight is believed only if fighting is better for the incumbent than accommodating.
 * Committing to fight costs `k` and removes accommodating from the incumbent's options.
 */
export class Deterrence {
  readonly out: Pay;
  readonly acc: Pay;
  readonly fight: Pay;
  readonly k: number;

  constructor(out: Pay, acc: Pay, fight: Pay, k: number) {
    this.out = out;
    this.acc = acc;
    this.fight = fight;
    this.k = k;
  }

  /** Would the incumbent really fight, left to choose? */
  get credible(): boolean {
    return this.fight[1] > this.acc[1];
  }

  /** What happens. `committed` removes accommodating and costs k. */
  outcome(committed: boolean): { enters: boolean; fights: boolean; incumbent: number; entrant: number } {
    const fights = committed || this.credible;
    const inside = fights ? this.fight : this.acc;
    const enters = inside[0] > this.out[0];
    const pay = enters ? inside : this.out;
    return { enters, fights: enters && fights, incumbent: pay[1] - (committed ? this.k : 0), entrant: pay[0] };
  }

  /** Is committing better than leaving it as a threat? */
  get commitPays(): boolean {
    return this.outcome(true).incumbent > this.outcome(false).incumbent;
  }
}

/** Three rounds. A threat nobody believes, a commitment that pays, and a threat that was already believable. */
export const FEEL_CASES: readonly Deterrence[] = [
  new Deterrence([0, 6], [3, 3], [-2, 0], 1),
  new Deterrence([0, 7], [2, 4], [-1, 1], 2),
  new Deterrence([0, 6], [3, 3], [-2, 5], 2),
];

/** New cases for Prove. Commit, do not need to, and too costly. */
export const PROVE_CASES: readonly Deterrence[] = [
  new Deterrence([0, 8], [4, 3], [-3, 1], 2),
  new Deterrence([0, 6], [2, 2], [-2, 4], 2),
  new Deterrence([0, 5], [3, 4], [-2, 0], 3),
];
