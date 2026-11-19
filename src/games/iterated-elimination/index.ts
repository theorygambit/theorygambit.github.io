import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { IteratedEliminationGame } from "./IteratedEliminationGame";

const theory: TheoryEntry = {
  idea: "Cross out any choice that is always worse than another. Once it is gone, the other player's choices look different, and new ones become worse. Repeat until the table stops shrinking.",
  taught: [
    { beat: "Feel", text: "Pick a row three times. Each time the rows you skipped show what they would have paid." },
    { beat: "See", text: "Strike the choices that are always worse, one by one, and watch a new one become strikable." },
    { beat: "Prove", text: "Two new tables. Strike your way down to the one cell that survives." },
  ],
  math: [
    { label: "Strictly dominated", expr: "row i is struck if some row j pays more against every column still alive" },
    { label: "Columns work the same way", expr: "judged by the other player's payoffs" },
    { label: "Order does not change the survivor", expr: "for strict dominance, any order ends at the same cells" },
  ],
  remember: "Strike what is always worse. The table shrinks and new strikes appear.",
  practice: "Pricing, bidding and voting games often shrink step by step once obviously bad options are gone. It also shows what you must assume about the other player: that they will not play a dominated choice.",
  origin: "Iterated elimination of dominated strategies is the oldest solution method in game theory, and it rests on common knowledge of rationality. If it ends at one cell, that cell is the Nash equilibrium.",
};

export const iteratedElimination: GameModule = {
  slug: "iterated-elimination",
  hook: "Cross out what no one would play. Repeat.",
  create: (env) => new IteratedEliminationGame(env),
  theory,
};
