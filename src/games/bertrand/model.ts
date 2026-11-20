import type { Rng } from "../../core/Rng";

/**
 * Identical goods. `buyers` people each want one unit and pay at most `value`.
 * The cheaper firm gets every buyer, a tie splits them. Profit is (price - cost) times buyers.
 */
export class PriceWar {
  readonly value: number;
  readonly buyers: number;
  readonly tick: number;

  constructor(value = 10, buyers = 10, tick = 1) {
    this.value = value;
    this.buyers = buyers;
    this.tick = tick;
  }

  /** Buyers a firm charging `mine` serves against a rival charging `theirs`. */
  won(mine: number, theirs: number): number {
    if (mine > this.value) return 0;
    if (mine < theirs) return this.buyers;
    if (mine === theirs) return this.buyers / 2;
    return 0;
  }

  profit(mine: number, theirs: number, cost: number): number {
    return (mine - cost) * this.won(mine, theirs);
  }

  /** Every price a firm could sensibly name, from cost up to the buyers' value. */
  prices(cost: number): number[] {
    const out: number[] = [];
    for (let p = cost; p <= this.value + 1e-9; p += this.tick) out.push(Math.round(p * 1000) / 1000);
    return out;
  }

  /** The price that earns most against `theirs`, found by trying them all. Ties go to the lower price. */
  bestReply(theirs: number, cost: number): number {
    let best = cost;
    let top = -Infinity;
    for (const p of this.prices(cost)) {
      const v = this.profit(p, theirs, cost);
      if (v > top + 1e-9) {
        top = v;
        best = p;
      }
    }
    return best;
  }

  /** The Feel rival: opens high, then goes one tick under your last price, never below one tick above cost. */
  feelRival(round: number, yourLast: number | null, cost: number): number {
    if (round === 0 || yourLast === null) return 9;
    return Math.max(cost + this.tick, yourLast - this.tick);
  }

  /** Where a price war ends: at cost, or one tick above it on a grid with ties. */
  settles(price: number, cost: number): boolean {
    return price >= cost - 1e-9 && price <= cost + this.tick + 1e-9;
  }

  /** A firm with the lower cost prices just under the rival's cost. */
  limitPrice(rivalCost: number): number {
    return rivalCost - this.tick;
  }
}

export const FEEL_COST = 2;
export const WAR = new PriceWar();

export type CaseKind = "same" | "cheaper";

/** One Prove puzzle. `mine` and `theirs` are unit costs. */
export class PriceCase {
  readonly kind: CaseKind;
  readonly mine: number;
  readonly theirs: number;

  constructor(kind: CaseKind, mine: number, theirs: number) {
    this.kind = kind;
    this.mine = mine;
    this.theirs = theirs;
  }

  /** The price the player should name. For two equal firms: cost. For a cheaper firm: just under the rival's cost. */
  get answer(): number {
    return this.kind === "same" ? this.mine : WAR.limitPrice(this.theirs);
  }

  accepts(price: number): boolean {
    return this.kind === "same" ? WAR.settles(price, this.mine) : price === this.answer;
  }

  /** Your profit at `price` when the rival will not go under its own cost. */
  profitAt(price: number): number {
    return WAR.profit(price, this.kind === "same" ? this.mine : this.theirs, this.mine);
  }

  get bestProfit(): number {
    return this.profitAt(this.answer);
  }
}

const SAME_COSTS: readonly number[] = [3, 4, 5];
/** Cheaper firm cases with a gap of at least 3, so the best price is unique. */
const CHEAPER: readonly (readonly [number, number])[] = [[3, 6], [4, 7], [3, 7], [5, 8]];

/** Two new cases: two equal firms, then a firm with a cost edge. Costs never match the Feel round. */
export function proveSet(rng: Rng): PriceCase[] {
  const [m, t] = rng.pick(CHEAPER);
  return [new PriceCase("same", rng.pick(SAME_COSTS), rng.pick(SAME_COSTS)), new PriceCase("cheaper", m, t)].map((c) => (c.kind === "same" ? new PriceCase("same", c.mine, c.mine) : c));
}
