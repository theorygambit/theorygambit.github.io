import type { Rng } from "../../core/Rng";

export type Spin = "win" | "near" | "loss";

/**
 * A three reel machine. A win is three matches, a near miss is two, and a loss is one or none.
 * Every spin is drawn fresh, so the chance of a win never depends on what came before.
 */
export class Machine {
  readonly p: number;
  readonly near: number;
  readonly prize: number;
  readonly cost: number;

  constructor(p: number, near: number, prize: number, cost: number) {
    this.p = p;
    this.near = near;
    this.prize = prize;
    this.cost = cost;
  }

  draw(rng: Rng): Spin {
    const x = rng.next();
    return x < this.p ? "win" : x < this.p + this.near ? "near" : "loss";
  }

  /** Average gain per spin. */
  get ev(): number {
    return this.p * this.prize - this.cost;
  }

  /** The chance the next spin wins, given how the last one went. Always p. */
  nextWin(_prev: Spin): number {
    return this.p;
  }

  /** Which reels match, as booleans, for drawing. At least one reel always differs unless it is a win. */
  reels(spin: Spin, rng: Rng): boolean[] {
    if (spin === "win") return [true, true, true];
    if (spin === "near") {
      const odd = rng.int(0, 2);
      return [0, 1, 2].map((i) => i !== odd);
    }
    const lone = rng.chance(0.5) ? rng.int(0, 2) : -1;
    return [0, 1, 2].map((i) => i === lone);
  }
}

export const FEEL_MACHINE = new Machine(0.1, 0.4, 6, 1);
export const MAX_SPINS = 8;
export const START_COINS = 10;

export interface Decision {
  after: Spin;
  again: boolean;
}

export interface Rate {
  again: number;
  of: number;
}

/** How often you spun again after a near miss and after a clear loss. */
export function continuation(history: readonly Decision[]): { near: Rate; loss: Rate } {
  const rate = (k: Spin): Rate => {
    const h = history.filter((d) => d.after === k);
    return { again: h.filter((d) => d.again).length, of: h.length };
  };
  return { near: rate("near"), loss: rate("loss") };
}

/** Two machines for Prove. One is worth playing on and one is not, whatever the reels show. */
export const PROVE_MACHINES: readonly Machine[] = [new Machine(0.05, 0.5, 10, 1), new Machine(0.2, 0.3, 8, 1)];
