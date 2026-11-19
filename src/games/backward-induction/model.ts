import type { Rng } from "../../core/Rng";

/**
 * A pile game. Players take turns removing 1 to `max` stones. Whoever takes the last stone wins.
 * Solving it from the end: a pile of 0 is lost for the player to move, and a pile is lost exactly
 * when every move leaves a won pile for the opponent.
 */
export class Pile {
  readonly size: number;
  readonly max: number;

  constructor(size: number, max: number) {
    this.size = size;
    this.max = max;
  }

  /** Does the player to move lose from this many stones, with best play? */
  lost(n: number): boolean {
    return n % (this.max + 1) === 0;
  }

  /** The takes that leave the opponent in a lost position. */
  winningTakes(n: number): number[] {
    const out: number[] = [];
    for (let t = 1; t <= Math.min(this.max, n); t++) if (this.lost(n - t)) out.push(t);
    return out;
  }

  /** A perfect opponent: wins when it can, otherwise takes one and hopes. */
  reply(n: number, rng: Rng): number {
    const w = this.winningTakes(n);
    if (w.length) return w[0]!;
    return rng.int(1, Math.min(this.max, n));
  }
}

export const FEEL_PILE = new Pile(7, 2);

export interface PileCase {
  pile: Pile;
  answer: number;
}

/** First mover wins in every case, with a different take limit and size than Feel. */
export const PROVE_POOL: readonly PileCase[] = [
  { pile: new Pile(10, 3), answer: 2 },
  { pile: new Pile(11, 3), answer: 3 },
  { pile: new Pile(9, 3), answer: 1 },
  { pile: new Pile(13, 3), answer: 1 },
  { pile: new Pile(8, 2), answer: 2 },
  { pile: new Pile(10, 2), answer: 1 },
  { pile: new Pile(11, 2), answer: 2 },
];
