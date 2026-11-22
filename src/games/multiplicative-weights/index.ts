import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MultiplicativeWeightsGame } from "./MultiplicativeWeightsGame";

const theory: TheoryEntry = {
  idea: "Keep a weight for every option. After each round, shrink the weight of options that did badly, and play in proportion to the weights. Over many rounds you do almost as well as the best single option in hindsight, whatever the world does. Self-play with this rule also converges to equilibrium in zero-sum games.",
  taught: [
    { beat: "Feel", text: "Past results give each option a weight. Back the heaviest, or spread by weight." },
    { beat: "See", text: "Tap to play rounds. Losers shrink, shares shift smoothly, nothing is ever dropped." },
    { beat: "Prove", text: "New weights and losses. Find the weight after a round." },
  ],
  math: [
    { label: "Update", expr: "w <- w x (1 - eps x loss)" },
    { label: "Play option i with chance", expr: "w_i / sum of weights" },
    { label: "Average regret", expr: "O(sqrt(ln n / T))" },
  ],
  remember: "Never bet everything on yesterday's winner. Spread, and let the weights move.",
  practice: "Online learning, ad selection, and no-regret play that finds equilibria in repeated games.",
  origin: "Nick Littlestone and Manfred Warmuth, 1994. Hedge: Freund and Schapire, 1997.",
};

export const multiplicativeWeights: GameModule = { slug: "multiplicative-weights", hook: "How do you learn without betting on one answer?", create: (env) => new MultiplicativeWeightsGame(env), theory };
