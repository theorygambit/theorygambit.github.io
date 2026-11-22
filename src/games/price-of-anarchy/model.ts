/**
 * Pigou's network. A share x of drivers take the variable route, which costs a x. The rest take the
 * fixed route, which costs c. Selfish drivers pile onto the variable route until it stops being cheaper.
 */
export class Pigou {
  readonly a: number;
  readonly c: number;

  constructor(a: number, c: number) {
    this.a = a;
    this.c = c;
  }

  variable(x: number): number {
    return this.a * x;
  }

  /** The average cost per driver when a share x takes the variable route. */
  average(x: number): number {
    return x * this.variable(x) + (1 - x) * this.c;
  }

  /** Where selfish choices settle: the variable route until it costs as much as the fixed one. */
  get selfish(): number {
    return this.a <= this.c ? 1 : this.c / this.a;
  }

  /** The split a planner would choose to minimise the average cost. */
  get optimum(): number {
    return Math.min(1, this.c / (2 * this.a));
  }

  /** How much worse selfish play is than the best split. */
  get anarchy(): number {
    return this.average(this.selfish) / this.average(this.optimum);
  }

  /** One day of drivers copying whichever route was cheaper yesterday. */
  drift(x: number): number {
    return Math.min(1, Math.max(0, x + 0.6 * (this.c - this.variable(x)) / Math.max(this.c, this.a)));
  }
}

export const FEEL_NETWORK = new Pigou(1, 1);

/** New slopes and fixed costs. Selfish play sits inside the range, the optimum is a different point. */
export const PROVE_POOL: readonly Pigou[] = [new Pigou(3, 2), new Pigou(4, 2), new Pigou(5, 2), new Pigou(2, 1.5)];

export const PROVE_TOLERANCE = 0.04;
