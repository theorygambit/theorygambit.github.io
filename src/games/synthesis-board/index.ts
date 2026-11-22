import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { SynthesisBoardGame } from "./SynthesisBoardGame";

const theory: TheoryEntry = {
  idea: "Dominance, mixing, trust, fairness and frames all at once. Every strategic situation has a structure, and naming it tells you the move: take the dominant option, be unpredictable when patterns are exploited, commit together when both gain only if both commit, offer enough that refusing costs more than accepting, and check whose picture of the game is right.",
  taught: [
    { beat: "Feel", text: "Four quick situations: dominance, mixing, trust and fairness. Pick the move." },
    { beat: "See", text: "Tap each idea on the board. Each has a rule and a situation where it applies." },
    { beat: "Prove", text: "Name the idea that fits a new situation." },
  ],
  math: [
    { label: "Dominance", expr: "u(a, s) > u(b, s) for every s" },
    { label: "Mixing", expr: "make the other side indifferent" },
    { label: "Trust and fairness", expr: "commit when both gain, offer above the refusal point" },
  ],
  remember: "Name the structure first. Then the move follows.",
  practice: "Everything in the app, in one place. Use it as a checklist whenever a decision depends on what others do.",
  origin: "A capstone of the curriculum, mixing dominant strategy, matching pennies, stag hunt, ultimatum, hypergame levels and metagames.",
};

export const synthesisBoard: GameModule = { slug: "synthesis-board", hook: "Can you name the game you are in?", create: (env) => new SynthesisBoardGame(env), theory };
