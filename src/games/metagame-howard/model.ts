import type { Rng } from "../../core/Rng";

/** The prisoner's dilemma: payoff to you for your move and theirs. */
export type Move = "C" | "D";
export const PAYOFF: Record<Move, Record<Move, number>> = { C: { C: 3, D: 0 }, D: { C: 5, D: 1 } };

/** A policy maps your move to theirs. */
export interface Policy {
  key: string;
  name: string;
  reply: (you: Move) => Move;
}
export const POLICIES: Record<string, Policy> = {
  copy: { key: "copy", name: "copy whatever you do", reply: (y) => y },
  alwaysD: { key: "alwaysD", name: "always defect", reply: () => "D" },
  alwaysC: { key: "alwaysC", name: "always cooperate", reply: () => "C" },
  opposite: { key: "opposite", name: "do the opposite of you", reply: (y) => (y === "C" ? "D" : "C") },
  grim: { key: "grim", name: "defect if you ever defect", reply: (y) => y },
};

export const payoff = (p: Policy, you: Move): number => PAYOFF[you][p.reply(you)];
export const bestMove = (p: Policy): Move => (payoff(p, "C") >= payoff(p, "D") ? "C" : "D");

export const FEEL_ORDER: readonly string[] = ["copy", "alwaysD", "opposite", "alwaysC"];
export const SEE_ORDER: readonly string[] = ["copy", "alwaysD", "alwaysC", "opposite"];

export const PROVE_POOL: readonly string[] = ["copy", "grim", "alwaysC", "alwaysD", "opposite"];
export function proveSet(rng: Rng): string[] {
  const c = PROVE_POOL.filter((k) => bestMove(POLICIES[k]!) === "C");
  const d = PROVE_POOL.filter((k) => bestMove(POLICIES[k]!) === "D");
  return rng.shuffle([rng.pick(c), rng.pick(d)]);
}
