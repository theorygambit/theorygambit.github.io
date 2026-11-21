/** Gains and losses from a reference point. A loss of x hurts lambda times as much as a gain of x pleases. */
export class Value {
  readonly lambda: number;

  constructor(lambda = 2) {
    this.lambda = lambda;
  }

  v(x: number): number {
    return x >= 0 ? x : this.lambda * x;
  }

  /** The felt value of a fair coin that wins `gain` or loses `loss`. */
  gamble(gain: number, loss: number): number {
    return 0.5 * this.v(gain) + 0.5 * this.v(-loss);
  }

  accepts(gain: number, loss: number): boolean {
    return this.gamble(gain, loss) > 0;
  }

  /** The smallest gain that makes the coin flip worth taking. */
  breakEven(loss: number): number {
    return this.lambda * loss;
  }
}

export const FEEL_VALUE = new Value(2);

export interface Flip {
  gain: number;
  loss: number;
}

/** Every flip has a positive average, yet gains below twice the loss feel like a bad deal. */
export const FEEL_FLIPS: readonly Flip[] = [
  { gain: 60, loss: 40 },
  { gain: 100, loss: 50 },
  { gain: 70, loss: 40 },
  { gain: 120, loss: 50 },
];

export interface Case {
  value: Value;
  loss: number;
}

/** New lambdas and losses, so the old answer (twice the loss) fails. */
export const PROVE_POOL: readonly Case[] = [
  { value: new Value(2.5), loss: 40 },
  { value: new Value(1.5), loss: 60 },
  { value: new Value(3), loss: 30 },
  { value: new Value(2.5), loss: 20 },
];

export const MAX_GAIN = 200;
