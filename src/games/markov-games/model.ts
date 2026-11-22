/**
 * Two states, Good and Bad. Each round you invest or coast. The chance that the next state is Good
 * depends on the current state and on your action, and on nothing earlier.
 */
export type State = "good" | "bad";
export type Action = "invest" | "coast";

export class Markov {
  readonly stay = { invest: 0.9, coast: 0.6 };
  readonly climb = { invest: 0.6, coast: 0.2 };
  readonly pay = { good: 3, bad: 1 };
  readonly cost = 1;

  /** Chance the next state is Good. */
  next(from: State, a: Action): number {
    return from === "good" ? this.stay[a] : this.climb[a];
  }

  /** Payoff this round. */
  reward(s: State, a: Action): number {
    return this.pay[s] - (a === "invest" ? this.cost : 0);
  }

  /** Long run share of rounds spent Good if you invest with probability alpha. */
  stationary(alpha: number): number {
    const q = alpha * this.climb.invest + (1 - alpha) * this.climb.coast;
    const p = 1 - (alpha * this.stay.invest + (1 - alpha) * this.stay.coast);
    return q / (p + q);
  }

  /** Long run average payoff per round under that mix. */
  average(alpha: number): number {
    const pi = this.stationary(alpha);
    return pi * this.pay.good + (1 - pi) * this.pay.bad - alpha * this.cost;
  }
}

export const FEEL_MARKOV = new Markov();

/** A chain with chance p of falling from Good and q of climbing from Bad. */
export interface Chain {
  p: number;
  q: number;
}

export function share(c: Chain): number {
  return c.q / (c.p + c.q);
}

/** New chains, none with a share near Feel's mixes. */
export const PROVE_POOL: readonly Chain[] = [{ p: 0.2, q: 0.6 }, { p: 0.5, q: 0.25 }, { p: 0.1, q: 0.3 }, { p: 0.4, q: 0.4 }];

export const PROVE_TOLERANCE = 0.05;
