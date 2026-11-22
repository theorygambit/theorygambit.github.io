/**
 * A coordination game. Both strategies pay only when matched: A pays a against A, B pays b against B.
 * The share x playing A grows when A earns more than B. The mixed share b / (a + b) is a tipping point:
 * above it A takes over, below it B does.
 */
export class Coordination {
  readonly a: number;
  readonly b: number;

  constructor(a: number, b: number) {
    this.a = a;
    this.b = b;
  }

  fitA(x: number): number {
    return this.a * x;
  }

  fitB(x: number): number {
    return this.b * (1 - x);
  }

  /** The share where both earn the same, and the population does not move. */
  get tipping(): number {
    return this.b / (this.a + this.b);
  }

  /** One generation of the replicator rule. */
  step(x: number): number {
    const eta = 1.5 / (this.a + this.b);
    const next = x + eta * x * (1 - x) * (this.fitA(x) - this.fitB(x)) * 2;
    return Math.min(0.99, Math.max(0.01, next));
  }

  /** Which way the share moves. */
  drift(x: number): 1 | -1 {
    return this.fitA(x) >= this.fitB(x) ? 1 : -1;
  }
}

export const FEEL_GAME = new Coordination(2, 1);

export const PROVE_POOL: readonly Coordination[] = [new Coordination(3, 1), new Coordination(1, 3), new Coordination(2, 3), new Coordination(3, 2)];

export const PROVE_TOLERANCE = 0.05;
