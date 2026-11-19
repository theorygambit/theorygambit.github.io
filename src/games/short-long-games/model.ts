/**
 * A prisoner's dilemma played n times against a partner who answers a betrayal with betrayal for good.
 * Holding every round earns R each round. Betraying first earns T once and then P each round.
 */
export class Repeated {
  readonly T: number;
  readonly R: number;
  readonly P: number;
  readonly S: number;

  constructor(T = 5, R = 3, P = 1, S = 0) {
    this.T = T;
    this.R = R;
    this.P = P;
    this.S = S;
  }

  hold(n: number): number {
    return n * this.R;
  }

  betray(n: number): number {
    return this.T + (n - 1) * this.P;
  }

  /** The fewest rounds at which holding pays strictly more than betraying first. */
  get breakEven(): number {
    return Math.floor((this.T - this.P) / (this.R - this.P)) + 1;
  }

  /** One round with a partner who copies your last move. */
  oneShot(you: "hold" | "break", them: "hold" | "break"): number {
    if (you === "hold") return them === "hold" ? this.R : this.S;
    return them === "hold" ? this.T : this.P;
  }
}

export const FEEL_GAME = new Repeated(5, 3, 1, 0);

/** New payoffs for Prove. Break even rounds differ from Feel (3), so the old answer fails. */
export const PROVE_POOL: readonly Repeated[] = [new Repeated(8, 3, 2, 0), new Repeated(10, 4, 1, 0), new Repeated(7, 5, 1, 0), new Repeated(9, 4, 2, 0)];

export const MAX_ROUNDS = 10;
