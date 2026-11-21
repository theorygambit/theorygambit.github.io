import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { SubgamePerfectGame } from "./SubgamePerfectGame";

const theory: TheoryEntry = {
  idea: "A plan is subgame perfect when it is a best reply at every point of the game, including points that are never reached. A threat that would hurt the one who makes it is not believed, so it cannot keep anyone out.",
  taught: [
    { beat: "Feel", text: "A rival says they will fight if you enter. Enter or stay out in four markets, and see when the threat is real." },
    { beat: "See", text: "Tap the last move first, then the first. Moves that nobody would carry out drop away, and the rest decides the game." },
    { beat: "Prove", text: "New payoffs. Decide whether to enter, with one real threat and one empty one." },
  ],
  math: [
    { label: "Last mover fights only if", expr: "fight payoff > accept payoff (for them)" },
    { label: "Then the entrant enters only if", expr: "payoff after their real reply > payoff of staying out" },
    { label: "Backward induction", expr: "solve the last move, then the one before it" },
  ],
  remember: "Solve the last move first. A threat counts only if carrying it out is the best reply when the time comes.",
  practice: "Price wars threatened against new rivals, strikes that would cost the union more than they cost the firm, and promises of punishment that nobody wants to deliver.",
  origin: "Reinhard Selten, 1965 and 1975. He separated equilibria that rest on empty threats from those that hold at every step.",
};

export const subgamePerfect: GameModule = { slug: "subgame-perfect", hook: "Would they really fight?", create: (env) => new SubgamePerfectGame(env), theory };
