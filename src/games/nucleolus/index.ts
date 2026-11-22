import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { NucleolusGame } from "./NucleolusGame";

const theory: TheoryEntry = {
  idea: "The excess of a group is what it could earn alone minus what a split gives it. The nucleolus is the split that makes the largest excess as small as possible, then the next largest, and so on. It always exists, is unique, and lies in the core whenever the core is not empty.",
  taught: [
    { beat: "Feel", text: "Pick the split that leaves the weakest pull to walk out." },
    { beat: "See", text: "Drag a split around the triangle. The disc grows as the biggest complaint shrinks." },
    { beat: "Prove", text: "New games. Find how small the biggest complaint can be made." },
  ],
  math: [
    { label: "Excess of group S", expr: "e(S, x) = v(S) - x(S)" },
    { label: "Nucleolus", expr: "minimise the largest e(S, x), then the next, and so on" },
    { label: "Three players, equal pair excesses", expr: "e = (v12 + v13 + v23 - 2 v(N)) / 3" },
  ],
  remember: "Fairness here means the most unhappy group is as content as it can be.",
  practice: "Settling a bankrupt estate, cost sharing, and any split where a single complaint can break a deal.",
  origin: "David Schmeidler, 1969.",
};

export const nucleolus: GameModule = { slug: "nucleolus", hook: "How do you make the unhappiest group as happy as possible?", create: (env) => new NucleolusGame(env), theory };
