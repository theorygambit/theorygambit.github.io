import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ZeroSumGame } from "./ZeroSumGame";

const theory: TheoryEntry = {
  idea: "In a zero-sum game the total is fixed, so whatever one side gains the other side loses. There is nothing to create, only to divide.",
  taught: [
    { beat: "Feel", text: "Four tugs of war over a pie of 10. The two discs trade area, and the total never changes." },
    { beat: "See", text: "Every round plotted. All the outcomes land on one straight line." },
    { beat: "Prove", text: "Three sets of outcomes. Decide whether each one shares a single total." },
  ],
  math: [
    { label: "Zero-sum", expr: "u_1(s) + u_2(s) = 0 for every outcome s" },
    { label: "Constant-sum (equivalent for strategy)", expr: "u_1(s) + u_2(s) = C for every outcome s" },
    { label: "In this game", expr: "You + They = 10, so every outcome lies on the line x + y = 10" },
    { label: "Consequence", expr: "Interests are strictly opposed, so cooperation cannot create value" },
  ],
  remember: "One fixed total, divided. Your gain is their loss.",
  practice: "Chess, poker, a single sale of a fixed prize and many sports are zero-sum. Most real life is not: trade, teamwork and conflict all change the total. Treating a positive-sum situation as zero-sum is a common mistake.",
  origin: "Von Neumann's minimax theorem (1928) solved finite two player zero-sum games and started game theory.",
};

export const zeroSum: GameModule = {
  slug: "zero-sum",
  hook: "A fixed pie: your gain is their loss.",
  create: (env) => new ZeroSumGame(env),
  theory,
};
