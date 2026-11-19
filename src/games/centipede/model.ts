import type { Rng } from "../../core/Rng";

export type Pay = readonly [number, number];

/**
 * Four nodes. At node 1 and 3 you decide, at 2 and 4 they do. Taking ends the game with `takes[i]`
 * (your payoff, their payoff). Passing at node 4 ends it with `finalPay`.
 */
export class Centipede {
  readonly takes: readonly Pay[];
  readonly finalPay: Pay;

  constructor(takes: readonly Pay[], finalPay: Pay) {
    this.takes = takes;
    this.finalPay = finalPay;
  }

  get nodes(): number {
    return this.takes.length;
  }

  /** 0 for you, 1 for them. */
  mover(node: number): 0 | 1 {
    return node % 2 === 0 ? 0 : 1;
  }

  /** The outcome of the game from `node` on, when everyone takes whenever taking pays more than the solved continuation. */
  solve(node = 0): { end: number | null; pay: Pay; strict: boolean } {
    if (node >= this.nodes) return { end: null, pay: this.finalPay, strict: true };
    const next = this.solve(node + 1);
    const m = this.mover(node);
    const take = this.takes[node]!;
    const strict = next.strict && take[m] !== next.pay[m];
    if (take[m] > next.pay[m]) return { end: node, pay: take, strict };
    return { end: next.end, pay: next.pay, strict };
  }

  /** The node (1 based) where the logical game ends, or null if everyone passes through. */
  get logicalEnd(): number | null {
    const e = this.solve().end;
    return e === null ? null : e + 1;
  }

  /** What the mover at `node` gets from taking and from passing, given everyone solves the rest. */
  compare(node: number): { take: number; pass: number } {
    const m = this.mover(node);
    return { take: this.takes[node]![m], pass: this.solve(node + 1).pay[m] };
  }
}

/** The Feel game. Logic ends at node 1 with (4, 1), though a trusting partner pays far more. */
export const FEEL_GAME = new Centipede([[4, 1], [2, 8], [16, 4], [8, 32]], [64, 16]);

/** The partner in Feel passes at node 2 and takes at node 4. */
export function trustingTake(node: number): boolean {
  return node === 3;
}

/** Play out Feel given your decisions at nodes 1 and 3 (true means take). Returns the end node (1 based) and payoff. */
export function playFeel(takeAt1: boolean, takeAt3: boolean): { end: number | null; pay: Pay } {
  const g = FEEL_GAME;
  if (takeAt1) return { end: 1, pay: g.takes[0]! };
  if (trustingTake(1)) return { end: 2, pay: g.takes[1]! };
  if (takeAt3) return { end: 3, pay: g.takes[2]! };
  if (trustingTake(3)) return { end: 4, pay: g.takes[3]! };
  return { end: null, pay: g.finalPay };
}

/** A random game whose logical end is `want` (1 to 4), with no ties anywhere along the way. */
export function generate(rng: Rng, want: number): Centipede {
  for (let tries = 0; tries < 400000; tries++) {
    const takes: Pay[] = Array.from({ length: 4 }, () => [rng.int(1, 30), rng.int(1, 30)] as Pay);
    const g = new Centipede(takes, [rng.int(1, 40), rng.int(1, 40)]);
    const s = g.solve();
    if (s.strict && g.logicalEnd === want) return g;
  }
  throw new Error("no centipede found");
}
