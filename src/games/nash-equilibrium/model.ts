import { Bimatrix } from "../shared/Bimatrix";
import type { Rng } from "../../core/Rng";

/** A random 3x3 table with no ties in any best reply and exactly `want` pure equilibria. */
export function equilibriumTable(rng: Rng, want: number): Bimatrix {
  for (let tries = 0; tries < 200000; tries++) {
    const a = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(0, 9)));
    const b = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(0, 9)));
    const m = new Bimatrix(a, b);
    let ties = false;
    for (let c = 0; c < 3; c++) if (m.bestRows(c).length !== 1) ties = true;
    for (let r = 0; r < 3; r++) if (m.bestCols(r).length !== 1) ties = true;
    if (ties) continue;
    if (m.equilibria().length === want) return m;
  }
  throw new Error("no table found");
}

/** Same cells, same order check: do two lists of cells hold the same cells? */
export function sameCells(a: readonly [number, number][], b: readonly [number, number][]): boolean {
  const key = (l: readonly [number, number][]) => l.map(([r, c]) => `${r}${c}`).sort().join(",");
  return key(a) === key(b);
}
