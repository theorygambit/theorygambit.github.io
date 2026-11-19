import { Bimatrix } from "../shared/Bimatrix";
import type { Rng } from "../../core/Rng";

export const TOTAL = 10;

/** A constant sum 3x3 table with a unique pure saddle point and no ties among row minima or column maxima. */
export function saddleTable(rng: Rng): Bimatrix {
  for (let tries = 0; tries < 200000; tries++) {
    const a = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(1, 9)));
    const m = Bimatrix.constantSum(a, TOTAL);
    const mm = m.maximin();
    const mx = m.minimax();
    if (mm.value !== mx.value) continue;
    const unique = (xs: number[], v: number) => xs.filter((x) => x === v).length === 1;
    if (!unique(mm.worst, mm.value) || !unique(mx.best, mx.value)) continue;
    // Not a table where every row has the same worst case.
    if (new Set(mm.worst).size < 3) continue;
    return m;
  }
  throw new Error("no saddle table found");
}

/** A fixed Feel table with a saddle. */
export const FEEL_TABLE = Bimatrix.constantSum([[6, 3, 8], [6, 5, 7], [9, 2, 1]], TOTAL);

export const ROW_NAMES = ["A", "B", "C"] as const;
export const COL_NAMES = ["X", "Y", "Z"] as const;
