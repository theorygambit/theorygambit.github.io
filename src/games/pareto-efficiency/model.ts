import type { Rng } from "../../core/Rng";

export type Pt = [number, number];

/** a dominates b when nobody is worse off and someone is better off. */
export const dominates = (a: Pt, b: Pt): boolean => a[0] >= b[0] && a[1] >= b[1] && (a[0] > b[0] || a[1] > b[1]);

/** Pareto efficient: no other outcome makes someone better off without making someone worse off. */
export const isEfficient = (p: Pt, set: readonly Pt[]): boolean => !set.some((q) => q !== p && dominates(q, p));

export const efficientSet = (set: readonly Pt[]): Pt[] => set.filter((p) => isEfficient(p, set));

/** The feasible outcomes are a quarter disc of radius 10. Its outer arc is the frontier. */
export const RADIUS = 10;
export const inRegion = (p: Pt): boolean => p[0] >= 0 && p[1] >= 0 && p[0] ** 2 + p[1] ** 2 <= RADIUS ** 2 + 1e-9;
export const onFrontier = (p: Pt): boolean => Math.abs(Math.hypot(p[0], p[1]) - RADIUS) < 0.05;

/**
 * One step of the veto rule: you may only move to outcomes at least as good for both sides, and
 * only inside the feasible region. Moving toward a target, left or down components are ignored.
 */
export function slide(p: Pt, target: Pt, step: number): Pt {
  const dx = Math.max(0, target[0] - p[0]);
  const dy = Math.max(0, target[1] - p[1]);
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return p;
  const k = Math.min(1, step / len);
  const tries: Pt[] = [
    [p[0] + dx * k, p[1] + dy * k],
    [p[0] + dx * k, p[1]],
    [p[0], p[1] + dy * k],
  ];
  for (const q of tries) if (inRegion(q) && (q[0] !== p[0] || q[1] !== p[1])) return q;
  return p;
}

export const STARTS: readonly Pt[] = [[2, 3], [4, 2], [3, 5]];

/** Six outcomes with at least two efficient and two not. */
export function puzzle(rng: Rng): Pt[] {
  for (let tries = 0; tries < 800; tries++) {
    const pts: Pt[] = [];
    while (pts.length < 6) {
      const p: Pt = [rng.int(1, 9), rng.int(1, 9)];
      if (pts.some((q) => Math.hypot((q[0] - p[0]) * 2.2, q[1] - p[1]) < 2.4)) continue;
      pts.push(p);
    }
    const n = efficientSet(pts).length;
    if (n >= 2 && n <= 4) return pts;
  }
  return [[2, 8], [4, 6], [3, 3], [7, 5], [9, 2], [5, 2]];
}
