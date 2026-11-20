import type { Rng } from "../../core/Rng";
import { PayoffTable } from "../shared/PayoffTable";

export type Place = "opera" | "football";

/**
 * You prefer the opera and they prefer football, but both would rather be together than apart.
 * Meeting at your favourite pays you `hi` and them `lo`, meeting at theirs the reverse, missing pays nothing.
 */
export class Outing {
  readonly hi: number;
  readonly lo: number;

  constructor(hi = 3, lo = 2) {
    this.hi = hi;
    this.lo = lo;
  }

  payoff(you: Place, them: Place): number {
    if (you !== them) return 0;
    return you === "opera" ? this.hi : this.lo;
  }

  /** Your expected payoff when they go to the opera with chance q. */
  ev(you: Place, q: number): number {
    return you === "opera" ? this.hi * q : this.lo * (1 - q);
  }

  /** The chance they go to the opera at which you do not care where you go. */
  get threshold(): number {
    return this.lo / (this.hi + this.lo);
  }

  best(q: number): Place {
    return this.ev("opera", q) > this.ev("football", q) ? "opera" : "football";
  }

  matrix(): PayoffTable {
    const p: Place[] = ["opera", "football"];
    return new PayoffTable(
      p.map((y) => p.map((t) => [this.payoff(y, t), y === t ? (t === "opera" ? this.lo : this.hi) : 0] as const)),
      ["Opera", "Football"],
      ["Opera", "Football"],
    );
  }
}

/** Chance each of five partners goes to the opera. */
export const PARTNER_ODDS: readonly number[] = [0.85, 0.15, 0.5, 0.7, 0.25];

export interface Table {
  bm: PayoffTable;
  /** Where the two stable cells are. */
  stable: [number, number][];
}

/** Two new tables with new numbers. In the second the columns are swapped, so the stable cells change place. */
export function proveTables(rng: Rng): Table[] {
  const make = (swap: boolean, names: [string, string]): Table => {
    const hi = rng.int(3, 5);
    const lo = rng.int(1, hi - 1);
    const cols = swap ? [1, 0] : [0, 1];
    const base = [
      [[hi, lo] as const, [0, 0] as const],
      [[0, 0] as const, [lo, hi] as const],
    ];
    const cells = [0, 1].map((r) => cols.map((c) => base[r]![c]!));
    const bm = new PayoffTable(cells, names, swap ? [names[1], names[0]] : names);
    return { bm, stable: bm.stable() };
  };
  const pairs: [string, string][] = rng.shuffle([["Cinema", "Concert"], ["Beach", "Hills"], ["Pizza", "Sushi"]] as [string, string][]);
  return [make(false, pairs[0]!), make(true, pairs[1]!)];
}
