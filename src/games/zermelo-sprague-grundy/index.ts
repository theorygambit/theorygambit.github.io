import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ZermeloSpragueGrundyGame } from "./ZermeloSpragueGrundyGame";

const theory: TheoryEntry = {
  idea: "In a finite game with perfect information and no chance, one side always has a winning plan, or both can force a draw. That is Zermelo's theorem. In Nim, the plan is one line: leave the xor of the pile sizes at zero. The Sprague-Grundy theorem then shows every such impartial game behaves like a Nim pile.",
  taught: [
    { beat: "Feel", text: "A game of Nim against a perfect player. Pick the move that leaves them stuck." },
    { beat: "See", text: "Tap a token to take it and all beyond it. Find the move that makes the xor of the piles zero." },
    { beat: "Prove", text: "New piles. Say whether the player to move wins." },
  ],
  math: [
    { label: "Position value", expr: "xor of the pile sizes" },
    { label: "Mover loses exactly when", expr: "xor = 0" },
    { label: "Winning move", expr: "make pile i equal to pile i xor the total" },
  ],
  remember: "In Nim, balance beats strength: leave zero and every reply breaks it.",
  practice: "Solving small board games by backward induction, and spotting when an alternating game is already decided.",
  origin: "Ernst Zermelo, 1913. Charles Bouton solved Nim, 1901. Roland Sprague, 1935, and Patrick Grundy, 1939.",
};

export const zermeloSpragueGrundy: GameModule = { slug: "zermelo-sprague-grundy", hook: "Is a perfect game already decided?", create: (env) => new ZermeloSpragueGrundyGame(env), theory };
