import { Bimatrix } from "../shared/Bimatrix";
import type { Rng } from "../../core/Rng";

/**
 * Three on each side. Rows are one side, columns the other. `a[r][c]` is how much row r likes column c
 * (3 best), `b[r][c]` how much column c likes row r. A matching is one column per row.
 */
export type Matching = readonly number[];

export const N = 3;

/** Every pair (r, c), not matched together, where both prefer each other to what they hold. */
export function blocking(m: Bimatrix, match: Matching): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (match[r] === c) continue;
    const owner = match.indexOf(c);
    if (m.mine(r, c) > m.mine(r, match[r]!) && m.theirs(r, c) > m.theirs(owner, c)) out.push([r, c]);
  }
  return out;
}

export function isStable(m: Bimatrix, match: Matching): boolean {
  return blocking(m, match).length === 0;
}

export interface Round {
  /** The column each still free row asks, by row. */
  asks: Map<number, number>;
  /** What each column holds after this round (row or -1). */
  holds: number[];
}

/** Rows ask in order of preference, columns keep the best asker so far. */
export function deferredAcceptance(m: Bimatrix): { rounds: Round[]; match: number[] } {
  const next = Array(N).fill(0) as number[];
  const order = Array.from({ length: N }, (_, r) => [...Array(N).keys()].sort((x, y) => m.mine(r, y) - m.mine(r, x)));
  const holds: number[] = Array(N).fill(-1);
  const rounds: Round[] = [];
  for (let guard = 0; guard < 30; guard++) {
    const free = [...Array(N).keys()].filter((r) => !holds.includes(r));
    if (free.length === 0) break;
    const asks = new Map<number, number>();
    for (const r of free) {
      const c = order[r]![next[r]!]!;
      next[r]!++;
      asks.set(r, c);
      const cur = holds[c]!;
      if (cur === -1 || m.theirs(r, c) > m.theirs(cur, c)) holds[c] = r;
    }
    rounds.push({ asks, holds: [...holds] });
  }
  const match = [...Array(N).keys()].map((r) => holds.indexOf(r));
  return { rounds, match };
}

/** A random table with strict preferences on both sides, and the first matching a person would try is not stable. */
export function randomMarket(rng: Rng): Bimatrix {
  for (let tries = 0; tries < 20000; tries++) {
    const side = () => Array.from({ length: N }, () => rng.shuffle([1, 2, 3]));
    const a = side();
    const b = [0, 1, 2].map(() => [0, 0, 0]);
    for (let c = 0; c < N; c++) {
      const rank = rng.shuffle([1, 2, 3]);
      for (let r = 0; r < N; r++) b[r]![c] = rank[r]!;
    }
    const m = new Bimatrix(a, b);
    const da = deferredAcceptance(m);
    if (da.rounds.length >= 2 && !isStable(m, [0, 1, 2])) return m;
  }
  throw new Error("no market found");
}

export const ROW_NAMES = ["A", "B", "C"] as const;
export const COL_NAMES = ["X", "Y", "Z"] as const;
