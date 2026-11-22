import type { Rng } from "../../core/Rng";

export type Choice = "continue" | "quit";

/**
 * A project you have already put `sunk` into. Finishing costs `cost` more and pays `payoff`.
 * The sunk amount is gone whether you go on or not, so only payoff against cost can matter.
 */
export class Venture {
  readonly sunk: number;
  readonly cost: number;
  readonly payoff: number;

  constructor(sunk: number, cost: number, payoff: number) {
    this.sunk = sunk;
    this.cost = cost;
    this.payoff = payoff;
  }

  /** What going on adds from here. */
  get ahead(): number {
    return this.payoff - this.cost;
  }

  /** Your balance at the end if you go on, counting the sunk amount as spent. */
  get finishTotal(): number {
    return this.ahead - this.sunk;
  }

  /** Your balance if you quit now. */
  get quitTotal(): number {
    return -this.sunk;
  }

  get best(): Choice {
    return this.ahead > 0 ? "continue" : "quit";
  }
}

/** Finishing costs 4 and pays 3. Only the sunk amount changes, so the right answer never does. */
export const FEEL_VENTURES: readonly Venture[] = [new Venture(1, 4, 3), new Venture(6, 4, 3), new Venture(12, 4, 3)];

/** Three new ventures. A huge sunk amount with a bad finish, no sunk amount with a good one, and a huge sunk amount with a good one. */
export function proveVentures(rng: Rng): Venture[] {
  const quit = new Venture(rng.int(8, 14), rng.int(3, 5), rng.int(1, 2));
  const fresh = new Venture(0, rng.int(1, 2), rng.int(4, 6));
  const stay = new Venture(rng.int(8, 14), rng.int(1, 2), rng.int(4, 6));
  return rng.shuffle([quit, fresh, stay]);
}
