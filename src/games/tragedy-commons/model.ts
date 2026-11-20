/**
 * n herders each put one or two sheep on a shared field. A sheep is worth (A - all sheep) / B,
 * so every sheep added lowers the value of every sheep, yours included.
 */
export class Pasture {
  readonly n: number;
  readonly A: number;
  readonly B: number;

  constructor(A = 13, B = 2, n = 5) {
    this.A = A;
    this.B = B;
    this.n = n;
  }

  private value(total: number): number {
    return Math.max(0, (this.A - total) / this.B);
  }

  /** Your payoff for `mine` sheep when k of the other n-1 herders put out two. */
  payoff(mine: number, k: number): number {
    const others = this.n - 1 + k;
    return mine * this.value(mine + others);
  }

  get allOne(): number {
    return this.payoff(1, 0);
  }

  get allTwo(): number {
    return this.payoff(2, this.n - 1);
  }

  /** Does a second sheep pay you whatever the others do? */
  get twoDominates(): boolean {
    for (let k = 0; k <= this.n - 1; k++) if (this.payoff(2, k) <= this.payoff(1, k)) return false;
    return true;
  }

  /** The trap: each gains by overgrazing, yet all are worse off when all do. */
  get tragic(): boolean {
    return this.twoDominates && this.allTwo < this.allOne;
  }

  /** The payoff of the lone deviator who puts out two while everyone else puts out one. */
  get alone(): number {
    return this.payoff(2, 0);
  }
}

/** How many of the four others put out two sheep in each Feel round. */
export const FEEL_OTHERS: readonly number[] = [1, 0, 3, 2, 4];

export const FEEL_PASTURE = new Pasture(13, 2, 5);

/** New fields. A tragedy, a field so rich that more sheep is fine, and one where a second sheep never pays. */
export const PROVE_PASTURES: readonly Pasture[] = [new Pasture(12, 1, 5), new Pasture(20, 2, 5), new Pasture(6.5, 1, 5)];
