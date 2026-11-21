/** Two sides, each worth `a` and `b` alone. Together they could produce `merged` to split. */
export interface Deal {
  a: number;
  b: number;
  merged: number;
}

export const surplus = (d: Deal): number => d.merged - d.a - d.b;

/** Your share `s` of the merged value works when both of you end up no worse off than alone. */
export const acceptable = (d: Deal, s: number): boolean => s >= d.a && d.merged - s >= d.b;

/** The shares both sides accept, or null when there is nothing to gain. */
export function range(d: Deal): [number, number] | null {
  return surplus(d) > 0 ? [d.a, d.merged - d.b] : null;
}

export const FEEL_DEALS: readonly Deal[] = [
  { a: 3, b: 4, merged: 10 },
  { a: 2, b: 2, merged: 7 },
  { a: 4, b: 3, merged: 11 },
];

/** Prove: two real deals and one with nothing to gain, in a fixed shuffle chosen by the game. */
export const PROVE_DEALS: readonly Deal[] = [
  { a: 4, b: 5, merged: 12 },
  { a: 6, b: 5, merged: 9 },
  { a: 3, b: 2, merged: 8 },
];

export const PLANE_MAX = 12;
