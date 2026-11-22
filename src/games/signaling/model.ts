/**
 * A worker studies for s years at a cost of c per year, where c is low for a strong type and high for a
 * weak one. An employer pays a premium W to anyone who studies at least s years. The signal is credible
 * when the strong type gains from it and the weak type does not: W / cWeak < s <= W / cStrong.
 */
export class Signal {
  readonly W: number;
  readonly cStrong: number;
  readonly cWeak: number;

  constructor(W: number, cStrong: number, cWeak: number) {
    this.W = W;
    this.cStrong = cStrong;
    this.cWeak = cWeak;
  }

  /** The payoff of meeting the bar of s years, net of the cost of studying. */
  net(strong: boolean, s: number): number {
    return this.W - (strong ? this.cStrong : this.cWeak) * s;
  }

  strongSignals(s: number): boolean {
    return this.net(true, s) >= 0;
  }

  weakSignals(s: number): boolean {
    return this.net(false, s) >= 0;
  }

  /** The bar separates the types when only the strong one clears it. */
  separates(s: number): boolean {
    return this.strongSignals(s) && !this.weakSignals(s);
  }

  get low(): number {
    return this.W / this.cWeak;
  }

  get high(): number {
    return this.W / this.cStrong;
  }
}

export const FEEL_SIGNAL = new Signal(6, 1, 2);

/** The bar the employer sets in Feel, inside the separating range (3, 6]. */
export const FEEL_BAR = 4;

export const PROVE_POOL: readonly Signal[] = [new Signal(8, 1, 4), new Signal(6, 2, 3), new Signal(9, 1, 3), new Signal(10, 2, 5)];

export const MAX_YEARS = 10;
