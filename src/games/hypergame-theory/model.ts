import type { Rng } from "../../core/Rng";

/** Each side plays the game it sees. A move the other side cannot see cannot be countered. */
export const COUNTER = 4;
/** Your pay from a move of raw worth `v`. If they can see it they counter it. */
export const pay = (v: number, seen: boolean, k: number = COUNTER): number => (seen ? Math.max(0, v - k) : v);

export interface Round {
  seen: number;
  hidden: number;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { seen: 8, hidden: 3 },
  { seen: 6, hidden: 4 },
  { seen: 10, hidden: 4 },
  { seen: 5, hidden: 3 },
];

export interface View {
  name: string;
  raw: number;
  seen: boolean;
}
export const SEE_MOVES: readonly View[] = [
  { name: "A", raw: 8, seen: true },
  { name: "B", raw: 7, seen: true },
  { name: "C", raw: 5, seen: false },
];

export interface Case {
  v: number;
  seen: boolean;
  k: number;
}
export const PROVE_POOL: readonly Case[] = [
  { v: 9, seen: true, k: 5 },
  { v: 6, seen: false, k: 5 },
  { v: 7, seen: true, k: 3 },
  { v: 4, seen: false, k: 2 },
  { v: 8, seen: true, k: 8 },
];
export const answer = (c: Case): number => pay(c.v, c.seen, c.k);
export const isRight = (c: Case, v: number, tol = 0.5): boolean => Math.abs(v - answer(c)) <= tol + 1e-9;

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
