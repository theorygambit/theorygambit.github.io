import { Bimatrix } from "../shared/Bimatrix";
import type { Rng } from "../../core/Rng";

/**
 * A random 3x3 table that strict dominance solves all the way to one cell, in at least three
 * strikes, with some strike that only becomes possible after an earlier one. Ties are rejected.
 */
export function solvableTable(rng: Rng): Bimatrix {
  for (let tries = 0; tries < 200000; tries++) {
    const a = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(0, 9)));
    const b = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(0, 9)));
    const m = new Bimatrix(a, b);
    const it = m.iterate();
    if (it.rows.length !== 1 || it.cols.length !== 1 || it.steps.length < 3) continue;
    const all = [0, 1, 2];
    // The cascade matters: not every strike was available at the start.
    const first = [m.dominatedRow(all, all) ? 1 : 0, m.dominatedCol(all, all) ? 1 : 0];
    if (first[0]! + first[1]! === 0) continue;
    if (!dependsOnEarlier(m)) continue;
    return m;
  }
  throw new Error("no solvable table found");
}

/** Some step needs an earlier strike: the same step is not legal on the full table. */
function dependsOnEarlier(m: Bimatrix): boolean {
  const all = [0, 1, 2];
  const it = m.iterate();
  const last = it.steps[it.steps.length - 1]!;
  if (last.kind === "row") return m.dominatedRow(all, all)?.index !== last.index;
  return m.dominatedCol(all, all)?.index !== last.index;
}

/** Columns the other player might choose: those not dominated on the full table. */
export function liveColumns(m: Bimatrix): number[] {
  const all = [0, 1, 2];
  const dom = m.dominatedCol(all, all);
  return all.filter((c) => c !== dom?.index);
}

export interface StrikeResult {
  ok: boolean;
  /** For a wrong strike: an alive opponent index where the item is not strictly worse than `by`. */
  why?: { other: number; against: number };
}

/** Is it legal to strike this row or column now? If not, name a counter case. */
export function tryStrike(m: Bimatrix, rows: readonly number[], cols: readonly number[], kind: "row" | "col", index: number): StrikeResult {
  if (kind === "row") {
    const d = m.dominatedRow(rows, cols);
    for (const j of rows) {
      if (j === index) continue;
      if (cols.every((c) => m.mine(j, c) > m.mine(index, c))) return { ok: true };
    }
    const j = rows.find((r) => r !== index)!;
    const against = cols.find((c) => m.mine(j, c) <= m.mine(index, c)) ?? cols[0]!;
    void d;
    return { ok: false, why: { other: j, against } };
  }
  for (const j of cols) {
    if (j === index) continue;
    if (rows.every((r) => m.theirs(r, j) > m.theirs(r, index))) return { ok: true };
  }
  const j = cols.find((c) => c !== index)!;
  const against = rows.find((r) => m.theirs(r, j) <= m.theirs(r, index)) ?? rows[0]!;
  return { ok: false, why: { other: j, against } };
}

export const ROW_NAMES = ["A", "B", "C"] as const;
export const COL_NAMES = ["X", "Y", "Z"] as const;
