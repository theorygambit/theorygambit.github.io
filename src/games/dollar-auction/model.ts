import type { Rng } from "../../core/Rng";

/**
 * A prize sold to the highest bid, in fixed steps. The highest bidder wins the prize and pays
 * their bid. The second highest bidder pays their bid too, and gets nothing.
 */
export class DollarAuction {
  readonly prize: number;
  readonly step: number;

  constructor(prize = 100, step = 10) {
    this.prize = prize;
    this.step = step;
  }

  /** What the winner of a top bid b ends with. */
  winnerNet(b: number): number {
    return this.prize - b;
  }

  /** What the runner up ends with. Their bid is one step below the top bid. */
  loserNet(b: number): number {
    return -(b - this.step);
  }

  /** What the two bidders end with together. */
  pairNet(b: number): number {
    return this.prize - this.take(b);
  }

  /** What the auctioneer collects: both bids. */
  take(b: number): number {
    return 2 * b - this.step;
  }

  /** The smallest top bid, in whole steps, at which the two bids together exceed the prize. */
  breakEvenBid(): number {
    let b = this.step;
    while (this.take(b) <= this.prize) b += this.step;
    return b;
  }
}

/**
 * One bidding war against a rival with a hidden budget. The rival raises whenever its next bid
 * fits inside the budget. You open, then each of your raises tops their bid by one step.
 */
export class Escalation {
  readonly auction: DollarAuction;
  readonly budget: number;
  you = 0;
  rival = 0;
  over: "none" | "walked" | "won" = "none";

  constructor(auction: DollarAuction, budget: number) {
    this.auction = auction;
    this.budget = budget;
  }

  /** You bid one step, the rival tops it. */
  open(): void {
    this.you = this.auction.step;
    this.rival = this.you + this.auction.step;
    this.over = "none";
  }

  /** The bid you would make by raising. */
  get nextRaise(): number {
    return this.rival + this.auction.step;
  }

  /** Your raise. The rival has not answered yet. */
  raise(): void {
    this.you = this.nextRaise;
  }

  /** The rival answers your raise: tops it if the budget allows, otherwise quits and you win. */
  respond(): void {
    const next = this.you + this.auction.step;
    if (next <= this.budget) this.rival = next;
    else this.over = "won";
  }

  walk(): void {
    this.over = "walked";
  }

  youNet(): number {
    return this.over === "won" ? this.auction.prize - this.you : -this.you;
  }

  rivalNet(): number {
    return this.over === "won" ? -this.rival : this.auction.prize - this.rival;
  }

  get take(): number {
    return this.you + this.rival;
  }
}

export const FEEL_AUCTION = new DollarAuction(100, 10);
export const BUDGETS: readonly number[] = [130, 140, 150];

/** Prove cases. Break even bids are all different from the Feel answer of 60. */
export const PROVE_POOL: readonly { prize: number; step: number }[] = [
  { prize: 60, step: 10 },
  { prize: 150, step: 25 },
  { prize: 200, step: 20 },
  { prize: 80, step: 10 },
  { prize: 120, step: 30 },
  { prize: 110, step: 10 },
];

/** Two different cases with different answers, drawn so a replay differs. */
export function proveSet(rng: Rng): DollarAuction[] {
  const mix = rng.shuffle(PROVE_POOL);
  const a = new DollarAuction(mix[0]!.prize, mix[0]!.step);
  const second = mix.slice(1).find((m) => new DollarAuction(m.prize, m.step).breakEvenBid() !== a.breakEvenBid())!;
  return [a, new DollarAuction(second.prize, second.step)];
}
