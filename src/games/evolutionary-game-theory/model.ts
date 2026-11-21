/**
 * Hawk and Dove. A hawk takes the whole prize V and fights hawks at cost C. A dove shares with doves
 * and gives way to hawks. With V < C neither strategy wins outright: hawks spread while they are rare,
 * doves spread while hawks are common, and the share settles at V / C.
 */
export class HawkDove {
  readonly V: number;
  readonly C: number;

  constructor(V: number, C: number) {
    this.V = V;
    this.C = C;
  }

  /** Average payoff to a hawk when a share x of the population are hawks. */
  hawk(x: number): number {
    return (x * (this.V - this.C)) / 2 + (1 - x) * this.V;
  }

  /** Average payoff to a dove. */
  dove(x: number): number {
    return ((1 - x) * this.V) / 2;
  }

  /** The population average payoff. */
  average(x: number): number {
    return x * this.hawk(x) + (1 - x) * this.dove(x);
  }

  /** The hawk share where both strategies earn the same. */
  get stable(): number {
    return this.V / this.C;
  }

  /** One generation: strategies that beat the average grow, the rest shrink. */
  step(x: number): number {
    const next = x + 2 * x * (1 - x) * (this.hawk(x) - this.dove(x));
    return Math.min(0.98, Math.max(0.02, next));
  }

  /** Which way the share moves: 1 toward more hawks, -1 toward fewer. */
  drift(x: number): 1 | -1 {
    return this.hawk(x) >= this.dove(x) ? 1 : -1;
  }
}

export const FEEL_GAME = new HawkDove(2, 4);

/** Prove tables, each with a different settling share, none at one half. */
export const PROVE_POOL: readonly HawkDove[] = [new HawkDove(2, 5), new HawkDove(3, 4), new HawkDove(1, 4), new HawkDove(3, 5)];

export const PROVE_TOLERANCE = 0.05;
