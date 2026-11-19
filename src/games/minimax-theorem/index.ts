import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MinimaxTheoremGame } from "./MinimaxTheoremGame";

const theory: TheoryEntry = {
  idea: "In pure conflict, what you gain the rival loses. Pick the row whose worst case is best for you. The rival picks the column whose best case for you is lowest. In a zero sum game these two numbers meet.",
  taught: [
    { beat: "Feel", text: "Pick a row three times against a rival who always aims at your worst cell." },
    { beat: "See", text: "Tap every row for its floor and every column for its ceiling. The highest floor meets the lowest ceiling." },
    { beat: "Prove", text: "Two new tables. Tap the cell where the floor and the ceiling agree." },
  ],
  math: [
    { label: "Floor of a row", expr: "the smallest payoff in that row" },
    { label: "Maximin", expr: "the highest floor: what you can guarantee" },
    { label: "Ceiling of a column", expr: "the largest payoff to you in that column" },
    { label: "Minimax", expr: "the lowest ceiling: what the rival can hold you to" },
    { label: "Theorem", expr: "maximin = minimax, using mixed strategies when no pure saddle exists" },
  ],
  remember: "Guarantee your best worst case. The rival does the same, and the numbers meet.",
  practice: "Zero sum settings such as chess endgames, security games and some negotiations have a value that either side can secure. Reasoning from the worst case is safe because the rival gains exactly what you lose.",
  origin: "Von Neumann proved the minimax theorem in 1928. It is the starting point of game theory, and Nash equilibrium extends it beyond pure conflict.",
};

export const minimaxTheorem: GameModule = {
  slug: "minimax-theorem",
  hook: "Guarantee your best worst case.",
  create: (env) => new MinimaxTheoremGame(env),
  theory,
};
