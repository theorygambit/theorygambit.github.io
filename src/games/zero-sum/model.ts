import type { Rng } from "../../core/Rng";

export type Pt = [number, number];

export const sumOf = (p: Pt): number => p[0] + p[1];

/** Zero-sum, or constant-sum: every outcome splits the same total. */
export const isConstantSum = (pts: readonly Pt[]): boolean => pts.every((p) => Math.abs(sumOf(p) - sumOf(pts[0]!)) < 1e-9);

/** Tug of war: what you hold after you pull `y` and they pull `t`. The two scores always add to 10. */
export function afterTug(you: number, y: number, t: number): number {
  return Math.min(10, Math.max(0, you + (y - t)));
}

export const TOTAL = 10;

export interface SumPuzzle {
  points: Pt[];
  constant: boolean;
  /** Index of the point that breaks the pattern, or null. */
  outlier: number | null;
  total: number;
}

/** Four outcomes. Either all share one total, or exactly one does not. */
export function sumPuzzle(rng: Rng, constant: boolean): SumPuzzle {
  const total = rng.pick([8, 10, 12]);
  const xs = rng.shuffle([1, 2, 3, 4, 5, 6, 7].filter((v) => v < total)).slice(0, 4);
  const points: Pt[] = xs.map((x) => [x, total - x]);
  let outlier: number | null = null;
  if (!constant) {
    outlier = rng.int(0, 3);
    const [x, y] = points[outlier]!;
    // Pick a shift that really moves the point, even near the edges of the plane.
    const options = rng.shuffle([-3, -2, 2, 3]).map((s) => Math.max(0.5, Math.min(11, y + s))).filter((v) => Math.abs(v - y) >= 1.5);
    points[outlier] = [x, options[0] ?? y + 2.5];
  }
  return { points, constant, outlier, total };
}

export function puzzleSet(rng: Rng): SumPuzzle[] {
  const flags = rng.shuffle([true, false, true]);
  return flags.map((f) => sumPuzzle(rng, f));
}
