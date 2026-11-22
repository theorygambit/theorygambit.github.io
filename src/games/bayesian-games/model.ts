/**
 * An entrant decides whether to enter against an incumbent who is Tough with chance q and Weak otherwise.
 * Entering earns G against a Weak incumbent and loses L against a Tough one. Staying out earns 0. The
 * entrant best replies to its belief: enter when q is below G / (G + L).
 */
export class Entry {
  readonly G: number;
  readonly L: number;

  constructor(G: number, L: number) {
    this.G = G;
    this.L = L;
  }

  /** Expected payoff of entering when the incumbent is Tough with chance q. */
  enter(q: number): number {
    return this.G * (1 - q) - this.L * q;
  }

  /** The belief where entering and staying out are equally good. */
  get threshold(): number {
    return this.G / (this.G + this.L);
  }

  shouldEnter(q: number): boolean {
    return this.enter(q) > 0;
  }

  /** What entering pays once the type is known. */
  realised(tough: boolean): number {
    return tough ? -this.L : this.G;
  }
}

export const FEEL_ENTRY = new Entry(3, 2);

/** The belief shown each Feel round, on both sides of 0.6. */
export const FEEL_BELIEFS: readonly number[] = [0.3, 0.8, 0.5, 0.7];

export const PROVE_POOL: readonly Entry[] = [new Entry(4, 1), new Entry(2, 3), new Entry(5, 2), new Entry(1, 2)];

export const PROVE_TOLERANCE = 0.05;
