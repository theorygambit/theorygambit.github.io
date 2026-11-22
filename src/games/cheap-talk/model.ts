import type { Rng } from "../../core/Rng";

/**
 * A sender who knows the state (a number from 0 to 1) sends a free message, "low" or "high".
 * The sender wants the receiver to act a little above the state, by the bias b. With a small bias the sender is
 * indifferent at a cutoff, so the message splits the states and means something. With a large bias nothing is learned.
 */
export class Talk {
  readonly b: number;

  constructor(b: number) {
    this.b = b;
  }

  /** The state at which the sender is indifferent between saying low and high. Zero means the message splits nothing. */
  cutoff(): number {
    return Math.max(0, 0.5 - 2 * this.b);
  }

  informative(): boolean {
    return this.b < 0.25;
  }

  /** How much the receiver gains from listening, as the drop in squared error times 12. Zero when nothing is learned. */
  gain(): number {
    const c = this.cutoff();
    return 3 * c * (1 - c) * (this.informative() ? 1 : 0);
  }
}

/** Taking a message at face value: low means the lower half, high means the upper half. */
export const literal = (msg: "low" | "high"): number => (msg === "high" ? 0.75 : 0.25);
export const BLIND = 0.5;
/** Pay for acting at a when the state is s: four at a perfect guess, none at half a unit away. */
export const pay = (a: number, s: number): number => 4 * Math.max(0, 1 - 2 * Math.abs(a - s));

export interface Round {
  b: number;
  msg: "low" | "high";
  state: number;
}

export const FEEL_ROUNDS: readonly Round[] = [
  { b: 0.05, msg: "high", state: 0.8 },
  { b: 0.4, msg: "high", state: 0.2 },
  { b: 0.1, msg: "low", state: 0.1 },
  { b: 0.3, msg: "high", state: 0.3 },
];

export const SEE_MAX = 0.4;
export const PROVE_POOL: readonly number[] = [0.1, 0.15, 0.05, 0.35, 0.2];

export function proveSet(rng: Rng): Talk[] {
  const a = rng.pick(PROVE_POOL.filter((b) => b < 0.25));
  const rest = PROVE_POOL.filter((b) => b !== a);
  return rng.shuffle([new Talk(a), new Talk(rng.pick(rest))]);
}

export const isRight = (t: Talk, v: number, tol = 0.03): boolean => Math.abs(v - t.cutoff()) <= tol + 1e-9;
