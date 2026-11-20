import { PayoffTable } from "../shared/PayoffTable";

export type Move = "swerve" | "dare";

/**
 * Two drivers head for each other. T is the prize for daring while the other swerves,
 * R is the calm of both swerving, S is the sting of swerving alone, P is the crash.
 * In a real game of chicken T > R > S > P, so a crash is the worst thing there is.
 */
export class Chicken {
  readonly T: number;
  readonly R: number;
  readonly S: number;
  readonly P: number;

  constructor(T = 4, R = 3, S = 1, P = 0) {
    this.T = T;
    this.R = R;
    this.S = S;
    this.P = P;
  }

  payoff(you: Move, them: Move): number {
    if (you === "swerve") return them === "swerve" ? this.R : this.S;
    return them === "swerve" ? this.T : this.P;
  }

  /** Your expected payoff when they dare with chance q. */
  ev(you: Move, q: number): number {
    return this.payoff(you, "swerve") * (1 - q) + this.payoff(you, "dare") * q;
  }

  /** The chance they dare at which you do not care which you pick. */
  get threshold(): number {
    return (this.T - this.R) / (this.T - this.R + (this.S - this.P));
  }

  bestReply(q: number): Move {
    return this.ev("dare", q) > this.ev("swerve", q) ? "dare" : "swerve";
  }

  /** Rows are you, columns are them, both ordered swerve then dare. */
  matrix(): PayoffTable {
    const m: Move[] = ["swerve", "dare"];
    return new PayoffTable(
      m.map((y) => m.map((t) => [this.payoff(y, t), this.payoff(t, y)] as const)),
      ["Swerve", "Dare"],
      ["Swerve", "Dare"],
    );
  }

  /** You have thrown away the wheel and will dare. A rival who is rational swerves only if swerving beats the crash. */
  rivalReply(): Move {
    return this.S > this.P ? "swerve" : "dare";
  }
}

/** Chance each of five drivers dares. The best reply flips at one half for the standard payoffs. */
export const DRIVER_RATES: readonly number[] = [0.9, 0.2, 0.7, 0.4, 0.1];

/** New payoffs for Prove. In the middle one a crash is better than yielding, so the threat stops working. */
export const COMMIT_CASES: readonly Chicken[] = [new Chicken(5, 3, 2, 0), new Chicken(4, 3, 1, 2), new Chicken(6, 4, 1, 0)];
