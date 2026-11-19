import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { BackwardInductionGame } from "./BackwardInductionGame";

const theory: TheoryEntry = {
  idea: "To solve a game of turns, start at the end. Work out who wins when little is left, then use that to decide the step before, and keep going back to the start.",
  taught: [
    { beat: "Feel", text: "A pile of seven stones. Take one or two in turn, and whoever takes the last stone wins. The other player never slips." },
    { beat: "See", text: "Label the piles from zero upward. Every third pile is lost for whoever must move." },
    { beat: "Prove", text: "New pile sizes and a new take limit. Choose the first move that leaves a lost pile." },
  ],
  math: [
    { label: "Last position", expr: "0 stones: the player to move has lost" },
    { label: "Lost pile", expr: "every take leaves a won pile for the opponent" },
    { label: "Won pile", expr: "some take leaves a lost pile for the opponent" },
    { label: "Take 1 to m stones", expr: "piles that are multiples of m + 1 are lost" },
  ],
  remember: "Solve the end first. Leave your opponent a lost position every turn.",
  practice: "Chess endgames, bargaining deadlines and last round decisions are solved from the end. Knowing the final stage tells you what each earlier move is really worth.",
  origin: "Zermelo's 1913 theorem on chess is the first backward induction argument. Kuhn formalised it for finite games with perfect information, and Selten refined it as subgame perfection.",
};

export const backwardInduction: GameModule = {
  slug: "backward-induction",
  hook: "Solve it from the last move.",
  create: (env) => new BackwardInductionGame(env),
  theory,
};
