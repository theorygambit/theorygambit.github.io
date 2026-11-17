import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { DominantStrategyGame } from "./DominantStrategyGame";

const theory: TheoryEntry = {
  idea: "A strategy is dominant when it pays more than every alternative, whatever the other players do.",
  taught: [
    { beat: "Feel", text: "Four rounds. Each one also shows what the row you did not pick would have paid." },
    { beat: "See", text: "Tap each column and the better row appears. The same row wins both times." },
    { beat: "Prove", text: "Three new tables. Name the dominant row, or find that there is none." },
  ],
  math: [
    { label: "Strictly dominant strategy", expr: "u_i(s_i, s_-i) > u_i(s'_i, s_-i) for every s_-i and every s'_i != s_i" },
    { label: "In the first table", expr: "Down: 6 > 5 against Left, 3 > 2 against Right" },
  ],
  remember: "A dominant strategy is best against everything they could do.",
  practice: "Check for dominance before anything else. If you have a dominant move, play it. If your opponent has one, expect it, and plan around it. Designers use it to find options that are never worth choosing.",
  origin: "A basic solution concept. Iterated elimination of dominated strategies builds on it.",
};

export const dominantStrategy: GameModule = { slug: "dominant-strategy", hook: "Best no matter what they do.", create: (env) => new DominantStrategyGame(env), theory };
