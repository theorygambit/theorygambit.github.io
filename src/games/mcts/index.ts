import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { McTsGame } from "./McTsGame";

const theory: TheoryEntry = {
  idea: "Monte Carlo tree search judges a move by playing many random games from it, and grows the tree where it matters most. It picks the move with the best win rate plus a bonus for having few games, so it keeps testing moves it is unsure about.",
  taught: [
    { beat: "Feel", text: "Random games were played from two moves. Pick the one to play." },
    { beat: "See", text: "Drag how many games a move has had. Fewer games leave a bigger bonus for being unsure." },
    { beat: "Prove", text: "Two moves with their records. Say which one search tries next." },
  ],
  math: [
    { label: "Upper confidence score", expr: "wins / n + c x sqrt(ln N / n)" },
    { label: "Play the move with", expr: "the highest score" },
    { label: "As n grows", expr: "the bonus shrinks and the win rate decides" },
  ],
  remember: "A move with few games might still be great. Try it before you trust the numbers.",
  practice: "Game AI for Go and card games, planning under uncertainty, and any search where simulating is cheaper than solving.",
  origin: "Remi Coulom, 2006, with Kocsis and Szepesvari's UCT, 2006.",
};

export const mcts: GameModule = { slug: "mcts", hook: "How do you judge a move you cannot solve?", create: (env) => new McTsGame(env), theory };
