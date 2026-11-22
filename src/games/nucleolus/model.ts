import type { Rng } from "../../core/Rng";

/**
 * Three players. Alone each earns nothing, pairs earn v12, v13 and v23, and all three earn `total`.
 * The excess of a group is what it could earn alone minus what the split gives it. The nucleolus makes the worst excess as small as possible.
 */
export class Bloc {
  readonly v12: number;
  readonly v13: number;
  readonly v23: number;
  readonly total: number;

  constructor(v12: number, v13: number, v23: number, total = 12) {
    this.v12 = v12;
    this.v13 = v13;
    this.v23 = v23;
    this.total = total;
  }

  /** The biggest excess over every group, singles included. */
  worst(x: readonly number[]): number {
    return Math.max(this.v12 - x[0]! - x[1]!, this.v13 - x[0]! - x[2]!, this.v23 - x[1]! - x[2]!, -x[0]!, -x[1]!, -x[2]!);
  }

  /** The smallest the worst excess can be. */
  best(): number {
    return (this.v12 + this.v13 + this.v23 - 2 * this.total) / 3;
  }

  /** The split that reaches it. */
  split(): [number, number, number] {
    const e = this.best();
    return [e - this.v23 + this.total, e - this.v13 + this.total, e - this.v12 + this.total];
  }

  label(): string {
    return `${this.v12}, ${this.v13}, ${this.v23}`;
  }
}

export interface Round {
  game: Bloc;
  a: [number, number, number];
  b: [number, number, number];
}
export const FEEL_ROUNDS: readonly Round[] = [
  { game: new Bloc(8, 6, 4), a: [4, 4, 4], b: [6, 4, 2] },
  { game: new Bloc(8, 8, 8), a: [6, 3, 3], b: [4, 4, 4] },
  { game: new Bloc(10, 8, 6), a: [4, 4, 4], b: [6, 4, 2] },
  { game: new Bloc(9, 7, 5), a: [5, 5, 2], b: [6, 4, 2] },
];

/** Pay is how calm the split leaves the group. */
export const calm = (g: Bloc, x: readonly number[]): number => Math.max(0, Math.min(6, 4 - g.worst(x)));

export const SEE = new Bloc(8, 6, 4);

export const PROVE_POOL: readonly Bloc[] = [new Bloc(6, 6, 6), new Bloc(10, 8, 6), new Bloc(9, 7, 5), new Bloc(12, 9, 6), new Bloc(10, 10, 10)];

export function proveSet(rng: Rng): Bloc[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
export const isRight = (g: Bloc, v: number, tol = 0.26): boolean => Math.abs(v - g.best()) <= tol + 1e-9;
