import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { PositiveSumGame } from "./PositiveSumGame";

const theory: TheoryEntry = {
  idea: "In a positive-sum game, cooperation creates value, so there is more to share than before. The surplus is the reason to cooperate.",
  taught: [
    { beat: "Feel", text: "Three merges. Drag the split and compare each disc with its dashed alone ring. A deal works only if both discs are bigger than their rings." },
    { beat: "See", text: "Alone is one point. Together is a longer line. Only splits up and right of alone leave both sides better off." },
    { beat: "Prove", text: "Three new deals. Pick a split that works, or call no deal when the whole is worth less than the parts." },
  ],
  math: [
    { label: "Gains from trade", expr: "surplus = merged - a - b" },
    { label: "A split s is acceptable when", expr: "s >= a and merged - s >= b" },
    { label: "The range of deals", expr: "a <= s <= merged - b, which exists only if surplus > 0" },
    { label: "Positive-sum", expr: "total payoff is larger when players cooperate" },
  ],
  remember: "Cooperation pays when the whole is worth more than the parts.",
  practice: "Trade, partnerships, mergers and open source all create surplus. The hard part is the split: any division inside the range works, so bargaining power decides where it lands. When surplus is zero or negative, there is nothing to negotiate.",
  origin: "Gains from trade go back to Ricardo (1817). Positive-sum thinking underlies cooperative game theory and Nash bargaining.",
};

export const positiveSum: GameModule = {
  slug: "positive-sum",
  hook: "When together is worth more than apart.",
  create: (env) => new PositiveSumGame(env),
  theory,
};
