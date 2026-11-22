import type { Rng } from "../../core/Rng";

/** The board holds five ideas. Each has a one-line rule and a signature situation. */
export interface Idea {
  key: string;
  name: string;
  rule: string;
  clue: string;
}
export const IDEAS: readonly Idea[] = [
  { key: "dominance", name: "Dominance", rule: "Take the option that pays more whatever they do.", clue: "One option pays more whatever they do." },
  { key: "mixing", name: "Mixing", rule: "Be unpredictable when a pattern gets exploited.", clue: "They will exploit any pattern you show." },
  { key: "trust", name: "Trust", rule: "Commit together when both gain only if both commit.", clue: "Both gain only if both commit." },
  { key: "fairness", name: "Fairness", rule: "Offer enough that refusing costs them more than accepting.", clue: "They refuse offers they find unfair." },
  { key: "frames", name: "Frames", rule: "Act on the game they see, and check yours.", clue: "They are playing a different game than you think." },
];
export const idx = (key: string): number => IDEAS.findIndex((i) => i.key === key);

export interface Round {
  intro: [string, string];
  labels: [string, string];
  /** Pay for each choice. */
  pay: [number, number];
  why: string;
}
export const FEEL_ROUNDS: readonly Round[] = [
  { intro: ["Dominance. Whatever they do, A pays more.", "Pick A or B."], labels: ["A", "B"], pay: [4, 2], why: "The better option, whatever they do." },
  { intro: ["Mixing. They countered your last heads.", "Heads again, or tails?"], labels: ["Heads again", "Tails"], pay: [0, 6], why: "A repeat gets countered. Mix it up." },
  { intro: ["Trust. Stag pays 6 if they join, hare pays 3.", "They joined 3 of the last 4 times."], labels: ["Stag", "Hare"], pay: [6, 3], why: "When trust is earned, the joint risk pays." },
  { intro: ["Fairness. You split 10. They refuse below 3.", "Offer 2 or offer 4?"], labels: ["Offer 2", "Offer 4"], pay: [0, 6], why: "A refusal leaves you nothing. Offer enough." },
];

export interface Case {
  idea: number;
  other: number;
  first: boolean;
}
export const PROVE_POOL: readonly Case[] = [
  { idea: 0, other: 1, first: true },
  { idea: 1, other: 2, first: false },
  { idea: 2, other: 0, first: false },
  { idea: 3, other: 2, first: true },
  { idea: 4, other: 0, first: false },
];
export const answerSlot = (c: Case): 0 | 1 => (c.first ? 0 : 1);

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}
