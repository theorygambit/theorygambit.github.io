import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { RubinsteinBargainingGame } from "./RubinsteinBargainingGame";

const theory: TheoryEntry = {
  idea: "Two players take turns proposing how to split a pot that shrinks with every delay. The responder accepts any offer worth at least what waiting would bring, so the first proposer offers exactly that and keeps the rest. The more patient a player is, the more they get.",
  taught: [
    { beat: "Feel", text: "You offer first. If they refuse, the pot shrinks and they propose." },
    { beat: "See", text: "Drag how much of the pot waiting keeps. The first proposer keeps what is left." },
    { beat: "Prove", text: "New pots and shrink rates. Find what the first proposer keeps." },
  ],
  math: [
    { label: "Value of waiting for the responder", expr: "delta x pot" },
    { label: "Proposer keeps", expr: "pot - delta x pot" },
    { label: "Many rounds, equal patience", expr: "first share = 1 / (1 + delta)" },
  ],
  remember: "Offer what waiting is worth to them. Delay hurts the impatient.",
  practice: "Wage talks, contract talks, and any deal where each day without agreement costs both sides.",
  origin: "Ariel Rubinstein, 1982, building on Stahl, 1972.",
};

export const rubinsteinBargaining: GameModule = { slug: "rubinstein-bargaining", hook: "Who wins when waiting is costly?", create: (env) => new RubinsteinBargainingGame(env), theory };
