import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { CoreGame } from "./CoreGame";

const theory: TheoryEntry = {
  idea: "A split of the gains is in the core when no group of players can do better by walking away and acting on their own. The core is the set of splits that nobody can block. It can hold one split, many, or none.",
  taught: [
    { beat: "Feel", text: "Split a pot among three. If two players can earn more alone, they leave." },
    { beat: "See", text: "Drag a split around the triangle. Safe splits fill a region; blocked ones lose a pair." },
    { beat: "Prove", text: "New games and splits. Say whether the split is in the core and which pair would leave." },
  ],
  math: [
    { label: "Efficient split", expr: "x1 + x2 + x3 = v(N)" },
    { label: "No group can block", expr: "sum of x_i over S >= v(S) for every group S" },
    { label: "Three players, pair worth w", expr: "each x_i <= v(N) - w" },
  ],
  remember: "A split is only stable if every group already gets what it could earn alone.",
  practice: "Cost sharing, alliances, and matching markets. If the core is empty, any deal can be broken by someone.",
  origin: "Francis Edgeworth, 1881, and Donald Gillies, 1953, formalised for cooperative games by Lloyd Shapley.",
};

export const core: GameModule = { slug: "core", hook: "When can nobody walk away from the deal?", create: (env) => new CoreGame(env), theory };
