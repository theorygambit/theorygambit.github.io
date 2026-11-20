import type { Rng } from "../../core/Rng";

export type Firm = 1 | 2;

/**
 * Two firms choose quantities at the same time. The price is a minus the total sold (never below 0)
 * and each firm pays a cost per unit. Best reply to a rival selling q is (a - c - q) / 2: half of
 * what the rival leaves. The equilibrium is where both best replies hold at once.
 */
export class Duopoly {
  readonly a: number;
  readonly c1: number;
  readonly c2: number;

  constructor(a: number, c1: number, c2 = c1) {
    this.a = a;
    this.c1 = c1;
    this.c2 = c2;
  }

  get symmetric(): boolean {
    return this.c1 === this.c2;
  }

  cost(who: Firm): number {
    return who === 1 ? this.c1 : this.c2;
  }

  price(total: number): number {
    return Math.max(0, this.a - total);
  }

  /** Profit of firm `who` when firm 1 sells q1 and firm 2 sells q2. */
  profit(who: Firm, q1: number, q2: number): number {
    const mine = who === 1 ? q1 : q2;
    return mine * (this.price(q1 + q2) - this.cost(who));
  }

  /** Best quantity for `who` when the other firm sells `other`. */
  bestReply(who: Firm, other: number): number {
    return Math.max(0, (this.a - this.cost(who) - other) / 2);
  }

  equilibrium(): { q1: number; q2: number } {
    return { q1: (this.a - 2 * this.c1 + this.c2) / 3, q2: (this.a - 2 * this.c2 + this.c1) / 3 };
  }

  /** Total a single owner of both firms would sell (equal costs): half of a - c. */
  monopolyTotal(): number {
    return (this.a - this.c1) / 2;
  }
}

/** The Feel market: price 90 minus the total, no cost. Each firm sells 30 at equilibrium, earning 900. */
export const FEEL = new Duopoly(90, 0);

/** Rounds in the Feel beat. */
export const FEEL_ROUNDS = 5;

/** The rival replies to what you sold LAST round. In the first round it sells the equilibrium quantity. */
export function rivalQuantity(d: Duopoly, yourPrevious: number | null): number {
  return yourPrevious === null ? d.equilibrium().q2 : d.bestReply(2, yourPrevious);
}

export type Pair = { q1: number; q2: number };

/**
 * The staircase of best replies: you reply to their quantity, then they reply to yours, and so on.
 * Returns the start and the point after each reply.
 */
export function staircase(d: Duopoly, start: Pair, replies: number): [number, number][] {
  const pts: [number, number][] = [[start.q1, start.q2]];
  let { q1, q2 } = start;
  for (let i = 0; i < replies; i++) {
    if (i % 2 === 0) q1 = d.bestReply(1, q2);
    else q2 = d.bestReply(2, q1);
    pts.push([q1, q2]);
  }
  return pts;
}

/** Symmetric Prove markets: the answer is (a - c) / 3 for both. */
export const PROVE_SYMMETRIC: readonly Duopoly[] = [new Duopoly(84, 12), new Duopoly(100, 25), new Duopoly(72, 0), new Duopoly(63, 0)];

/** Asymmetric Prove markets: you are firm 1 and your cost is lower, so you sell more. */
export const PROVE_ASYMMETRIC: readonly Duopoly[] = [new Duopoly(90, 0, 30), new Duopoly(80, 10, 40)];

/** One symmetric and one asymmetric puzzle, drawn with the game's rng so a replay differs. */
export function proveSet(rng: Rng): Duopoly[] {
  return [rng.pick(PROVE_SYMMETRIC), rng.pick(PROVE_ASYMMETRIC)];
}

/** A point is right when each quantity is within this share of the demand intercept a. */
export const TOLERANCE = 0.045;

export function isRight(d: Duopoly, q1: number, q2: number): boolean {
  const e = d.equilibrium();
  const tol = TOLERANCE * d.a;
  return Math.abs(q1 - e.q1) <= tol && Math.abs(q2 - e.q2) <= tol;
}

/** The axis maximum for a Prove plane: comfortably past the largest equilibrium quantity. */
export function axisMax(d: Duopoly): number {
  const e = d.equilibrium();
  return Math.ceil((Math.max(e.q1, e.q2) * 2) / 10) * 10;
}
