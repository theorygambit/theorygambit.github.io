import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MinimaxAlphaBetaGame } from "./MinimaxAlphaBetaGame";

const theory: TheoryEntry = {
  idea: "To choose well in a game with moves and counter-moves, look ahead and assume the other side answers as badly for you as it can. Alpha-beta pruning gets the same answer while skipping the branches that a good rival would never allow.",
  taught: [
    { beat: "Feel", text: "You pick a branch, the rival picks the worst for you, and you pick a leaf. Leaves are your payoffs." },
    { beat: "See", text: "Back up the values: you take the larger, they take the smaller, you take the larger. The root is what you can force." },
    { beat: "Prove", text: "Two new trees. Tap the leaves that alpha-beta, reading left to right, never has to look at." },
  ],
  math: [
    { label: "Your move", expr: "value = max of the children" },
    { label: "Their move", expr: "value = min of the children" },
    { label: "Prune a max node", expr: "stop when a leaf is at least the best the rival already has elsewhere (β)" },
    { label: "Prune a min node", expr: "stop when a value is at most the best you already have elsewhere (α)" },
  ],
  remember: "Assume their best reply, and skip what they would never allow.",
  practice: "Chess and Go engines, planning under an adversary, security games and any search over moves and replies. Good move ordering prunes the most: read the likely best branch first.",
  origin: "Claude Shannon (1950) proposed minimax search for chess. Alpha-beta pruning was developed in the late 1950s and 1960s by Newell, Shaw and Simon, McCarthy and Knuth and Moore, and it still powers game engines.",
};

export const minimaxAlphaBeta: GameModule = {
  slug: "minimax-alpha-beta",
  hook: "How do you look ahead without looking at everything?",
  create: (env) => new MinimaxAlphaBetaGame(env),
  theory,
};
