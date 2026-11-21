import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { PlayersCountGame } from "./PlayersCountGame";

const theory: TheoryEntry = {
  idea: "One player faces nature, two players face a rival who responds, and many players add free riders, coalitions and crowds. Each extra player changes what the others' choices are worth to you.",
  taught: [
    { beat: "Feel", text: "A shared pot with one, two and five players. Invest your coin or keep it, and see what each choice would have paid." },
    { beat: "See", text: "The return per invested coin is r over n. It crosses what keeping pays at n = r, so investing stops paying as the group grows." },
    { beat: "Prove", text: "New multipliers. Find the largest group where investing alone still beats keeping." },
  ],
  math: [
    { label: "Payoff, n players, k others invest", expr: "invest: r(k+1)/n    keep: 1 + rk/n" },
    { label: "Return on one invested coin", expr: "r / n" },
    { label: "Investing pays when", expr: "r / n > 1, that is n < r" },
    { label: "Everyone investing beats no one investing", expr: "r > 1, even when n > r" },
  ],
  remember: "As the group grows, your share of what you add shrinks. Free riding gets stronger.",
  practice: "Shared tools, public goods, open source, climate action and tipping all share this shape. With one player there is no dilemma. With two the incentive to free ride appears. With many it dominates, which is why large groups need rules, norms or enforcement.",
  origin: "The public goods game dates to Samuelson (1954) and Olson (1965), The Logic of Collective Action, which showed large groups struggle to supply shared goods.",
};

export const playersCount: GameModule = {
  slug: "players-count",
  hook: "Why bigger groups free ride more.",
  create: (env) => new PlayersCountGame(env),
  theory,
};
