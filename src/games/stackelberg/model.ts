import type { Rng } from "../../core/Rng";

/**
 * A leader commits to a quantity, then the follower sees it and replies. Price is a minus the
 * total sold (never below 0) and each firm pays the same cost per unit. The follower replies
 * with half of what the leader leaves. Knowing that, the leader commits to half of a - c.
 */
export class Leader {
  readonly a: number;
  readonly c: number;

  constructor(a: number, c: number) {
    this.a = a;
    this.c = c;
  }

  price(total: number): number {
    return Math.max(0, this.a - total);
  }

  /** The follower's best reply to a committed q1. */
  reply(q1: number): number {
    return Math.max(0, (this.a - this.c - q1) / 2);
  }

  /** Profit of a firm selling `mine` when the other sells `other`. */
  profit(mine: number, other: number): number {
    return mine * (this.price(mine + other) - this.c);
  }

  /** Leader profit when the follower reacts. */
  leaderProfit(q1: number): number {
    return this.profit(q1, this.reply(q1));
  }

  followerProfit(q1: number): number {
    return this.profit(this.reply(q1), q1);
  }

  /** Leader profit if the rival ignored the commitment and kept selling `stay`. */
  stayProfit(q1: number, stay: number): number {
    return this.profit(q1, stay);
  }

  /** The leader's best commitment: half of a - c. */
  bestLead(): number {
    return (this.a - this.c) / 2;
  }

  /** What each firm earns when both choose at the same time: (a - c)^2 / 9. */
  cournotProfit(): number {
    return ((this.a - this.c) * (this.a - this.c)) / 9;
  }
}

export const FEEL = new Leader(90, 0);
export const FEEL_ROUNDS = 4;

export interface Puzzle {
  kind: "lead" | "follow";
  d: Leader;
  /** For a follower puzzle, the quantity the leader committed to. */
  q1: number;
}

export const LEAD_POOL: readonly Leader[] = [new Leader(100, 40), new Leader(140, 20), new Leader(78, 0)];
export const FOLLOW_POOL: readonly { d: Leader; q1: number }[] = [
  { d: new Leader(80, 20), q1: 40 },
  { d: new Leader(96, 0), q1: 40 },
  { d: new Leader(70, 10), q1: 26 },
];

/** A right quantity is within this share of a. */
export const TOLERANCE = 0.06;

export function answer(p: Puzzle): number {
  return p.kind === "lead" ? p.d.bestLead() : p.d.reply(p.q1);
}

export function isRight(p: Puzzle, v: number): boolean {
  return Math.abs(v - answer(p)) <= TOLERANCE * p.d.a;
}

/** One leader and one follower puzzle, in shuffled order. */
export function proveSet(rng: Rng): Puzzle[] {
  const lead = rng.pick(LEAD_POOL);
  const f = rng.pick(FOLLOW_POOL);
  return rng.shuffle<Puzzle>([
    { kind: "lead", d: lead, q1: 0 },
    { kind: "follow", d: f.d, q1: f.q1 },
  ]);
}
