import type { Rng } from "../../core/Rng";

/** A two by two zero-sum game. You choose a row mix and your payoff is the entries [[a, b], [c, d]]. They choose the column that hurts you. */
export class Matrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;

  constructor(a: number, b: number, c: number, d: number) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }

  /** Your payoff against each column if you play the top row with chance p. */
  lines(p: number): [number, number] {
    return [p * this.a + (1 - p) * this.c, p * this.b + (1 - p) * this.d];
  }

  /** What you are guaranteed whatever they do. */
  floor(p: number): number {
    const [x, y] = this.lines(p);
    return Math.min(x, y);
  }

  /** The top row chance that makes both columns equal, when the game has no saddle point. */
  best(): number {
    return (this.d - this.c) / (this.a - this.c - this.b + this.d);
  }

  value(): number {
    return this.floor(this.best());
  }
}

export interface Round {
  m: Matrix;
}
export const FEEL_ROUNDS: readonly Matrix[] = [new Matrix(3, 0, 1, 2), new Matrix(3, 1, 0, 4), new Matrix(5, 1, 2, 3), new Matrix(0, 4, 3, 1)];

export const SEE = new Matrix(5, 1, 2, 3);

export const PROVE_POOL: readonly Matrix[] = [new Matrix(4, 1, 2, 3), new Matrix(2, 5, 4, 1), new Matrix(4, 0, 1, 3), new Matrix(6, 0, 2, 4)];

export function proveSet(rng: Rng): Matrix[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
export const isRight = (m: Matrix, v: number, tol = 0.26): boolean => Math.abs(v - m.value()) <= tol + 1e-9;
