import type { Rng } from "../../core/Rng";

/** The ladder of hypergame levels. `exploit` is what you earn by playing on their picture. */
export interface Level {
  level: number;
  short: string;
  /** Said in the first person of the other side. */
  desc: string;
  exploit: number;
}
export const LEVELS: readonly Level[] = [
  { level: 0, short: "Shared reality", desc: "Everyone sees the same game.", exploit: 1 },
  { level: 1, short: "Unaware", desc: "They are wrong and do not know it.", exploit: 6 },
  { level: 2, short: "Aware", desc: "They know you may see a different game.", exploit: 2 },
  { level: 3, short: "Known hedge", desc: "They hedge, and you know they hedge.", exploit: 5 },
];
export const SAFE = 3;

/** Rounds in Feel, as indices into the ladder. */
export const FEEL_ORDER: readonly number[] = [1, 2, 0, 3];

export interface Case {
  level: number;
  other: number;
  /** Whether the right label is first. */
  first: boolean;
}
export const PROVE_POOL: readonly Case[] = [
  { level: 1, other: 2, first: false },
  { level: 2, other: 3, first: true },
  { level: 0, other: 1, first: false },
  { level: 3, other: 2, first: false },
  { level: 1, other: 0, first: true },
];
export const answerSlot = (c: Case): 0 | 1 => (c.first ? 0 : 1);

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
