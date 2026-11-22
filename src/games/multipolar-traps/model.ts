/**
 * A contest among n rivals for a pie. Each has a level, and your share is pie × (1 + yours) / Σ(1 + theirs).
 * Raising your level costs `cost` that round and the level stays, so a rival must raise theirs to keep up.
 */
export class Contest {
  readonly n: number;
  readonly pie: number;
  readonly cost: number;

  constructor(n = 5, pie = 10, cost = 1) {
    this.n = n;
    this.pie = pie;
    this.cost = cost;
  }

  share(levels: readonly number[], i: number): number {
    const total = levels.reduce((a, l) => a + 1 + l, 0);
    return (this.pie * (1 + levels[i]!)) / total;
  }

  /** Your net for the round: your share minus what raising cost you. */
  net(levels: readonly number[], i: number, raised: boolean): number {
    return this.share(levels, i) - (raised ? this.cost : 0);
  }

  /** Everyone holding gives each of you this. */
  get fair(): number {
    return this.pie / this.n;
  }

  /** Raising your level alone, while all others hold. */
  get alone(): number {
    const lv = Array.from({ length: this.n }, (_, i) => (i === 0 ? 1 : 0));
    return this.net(lv, 0, true);
  }

  /** The cost at which raising alone stops paying: pie (n - 1) / (n (n + 1)). */
  get breakEven(): number {
    return (this.pie * (this.n - 1)) / (this.n * (this.n + 1));
  }

  /** Is it a trap: does raising pay, though everyone raising only costs everyone? */
  get trap(): boolean {
    return this.cost < this.breakEven;
  }
}

export const FEEL_CONTEST = new Contest(5, 10, 1);
export const ROUNDS = 5;

/** New contests for Prove. The player finds the cost that breaks the trap. */
export const PROVE_CONTESTS: readonly Contest[] = [new Contest(4, 12, 1), new Contest(3, 6, 1)];
export const MAX_COST = 3;
export const PROVE_TOLERANCE = 0.15;
