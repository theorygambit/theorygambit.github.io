import type { Rng } from "../../core/Rng";

export type Move = "fight" | "walk";
export type Pt = [number, number];

/** [you, they]. Walking away keeps the whole pie of 10. Every fight destroys some of it. */
export function payoff(you: Move, they: Move): Pt {
  if (you === "walk" && they === "walk") return [5, 5];
  if (you === "fight" && they === "walk") return [7, 2];
  if (you === "walk" && they === "fight") return [2, 7];
  return [3, 3];
}

export const PIE = 10;
export const destroyed = (p: Pt): number => PIE - p[0] - p[1];

/** Is an outcome worse for both than where you started? */
export const worseForBoth = (p: Pt, status: Pt): boolean => p[0] < status[0] && p[1] < status[1];

export const botMoves = (rng: Rng): Move[] => rng.shuffle<Move>(["fight", "walk", "fight", "fight"]);

export interface SelectPuzzle {
  status: Pt;
  points: Pt[];
}

/** Six outcomes around a status quo. At least one and at most three leave both worse off. */
export function selectPuzzle(rng: Rng): SelectPuzzle {
  for (let tries = 0; tries < 400; tries++) {
    const status: Pt = [rng.int(4, 7), rng.int(4, 7)];
    const points: Pt[] = [];
    while (points.length < 6) {
      const p: Pt = [rng.int(1, 9), rng.int(1, 9)];
      if (p[0] === status[0] || p[1] === status[1]) continue;
      if (points.some((q) => q[0] === p[0] && q[1] === p[1])) continue;
      if (points.some((q) => Math.hypot((q[0] - p[0]) * 2.2, q[1] - p[1]) < 2.4)) continue;
      points.push(p);
    }
    const n = points.filter((p) => worseForBoth(p, status)).length;
    if (n >= 1 && n <= 3) return { status, points };
  }
  return { status: [6, 6], points: [[2, 3], [4, 4], [8, 2], [3, 8], [9, 9], [7, 3]] };
}
