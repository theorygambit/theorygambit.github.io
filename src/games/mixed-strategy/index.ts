import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MixedStrategyGame } from "./MixedStrategyGame";

const theory: TheoryEntry = {
  idea: "When any fixed choice can be read and beaten, the best play is a mix: pick each action with set probabilities. The right mix makes the other player indifferent between their own options, so they cannot exploit you.",
  taught: [
    { beat: "Feel", text: "Six penalty kicks against a keeper who dives toward your more frequent side. Each kick shows what the other side would have scored." },
    { beat: "See", text: "Drag your share of left kicks. Two lines show the keeper's choices, and they cross at the mix that leaves the keeper no best dive." },
    { beat: "Prove", text: "Two new tables. Drag to the share where both dives score the same against you." },
  ],
  math: [
    { label: "Scoring chances here", expr: "kick L: 40% vs dive L, 90% vs dive R. Kick R: 80% vs dive L, 60% vs dive R" },
    { label: "Mix p = share of left kicks", expr: "vs dive L: 0.4p + 0.8(1 - p). vs dive R: 0.9p + 0.6(1 - p)" },
    { label: "Indifference", expr: "set them equal: p = 0.2 / 0.7, about 0.29" },
    { label: "Value of the mix", expr: "about 69% either way" },
  ],
  remember: "Mix so the other player is indifferent. Then no dive beats you.",
  practice: "Penalty kicks, serves in tennis, poker bluffs, audits and patrols all use unpredictability. The mix depends on the payoffs, not on a coin: the stronger side is not always used half the time.",
  origin: "Von Neumann showed mixed strategies in 1928, and Nash extended them to all finite games. Studies of penalty kicks and tennis serves find professionals mix close to the predicted shares.",
};

export const mixedStrategy: GameModule = {
  slug: "mixed-strategy",
  hook: "How unpredictable should you be?",
  create: (env) => new MixedStrategyGame(env),
  theory,
};
