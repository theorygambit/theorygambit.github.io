import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { RegretMatchingCfrGame } from "./RegretMatchingCfrGame";

const theory: TheoryEntry = {
  idea: "Regret matching plays each action in proportion to how much you regret not having played it, counting only the positive regrets. Played against itself, it drives average play toward an equilibrium. Counterfactual regret minimization applies the same rule at every decision point of a game tree, and powers the best poker programs.",
  taught: [
    { beat: "Feel", text: "Rock, paper, scissors against a habit. Play evenly or play by regret." },
    { beat: "See", text: "Tap each action to see how much you regret not having played it. The next mix follows the positive regrets." },
    { beat: "Prove", text: "From a set of regrets, find how often you play one action." },
  ],
  math: [
    { label: "Regret of action a", expr: "R(a) = payoff(a) - payoff(what you played)" },
    { label: "Next mix", expr: "p(a) = max(R(a), 0) / sum of positive regrets" },
    { label: "Self-play", expr: "average strategy -> equilibrium" },
  ],
  remember: "Only what you would gain by switching counts. Bad actions get no weight.",
  practice: "Poker bots, auction bidding, and any repeated game where you can compute what other actions would have paid.",
  origin: "Sergiu Hart and Andreu Mas-Colell, 2000. Counterfactual regret: Zinkevich and others, 2007.",
};

export const regretMatchingCfr: GameModule = { slug: "regret-matching-cfr", hook: "What if you play what you regret not playing?", create: (env) => new RegretMatchingCfrGame(env), theory };
