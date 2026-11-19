import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { NashEquilibriumGame } from "./NashEquilibriumGame";

const theory: TheoryEntry = {
  idea: "An outcome is a Nash equilibrium when each player is already giving their best reply to the other. Nobody can do better by changing only their own choice, so nobody moves.",
  taught: [
    { beat: "Feel", text: "Tap an outcome and see whether either player would switch, and what the switch would pay." },
    { beat: "See", text: "Ring your best reply in every column, then theirs in every row. Cells with both rings are the equilibria." },
    { beat: "Prove", text: "Two new tables. Tap every cell where nobody wants to move, then lock in." },
  ],
  math: [
    { label: "Best reply", expr: "BR(column) = the row with your highest payoff in that column" },
    { label: "Equilibrium", expr: "(r, c) where r is a best reply to c, and c is a best reply to r" },
    { label: "A table can hold", expr: "none, one or several pure equilibria" },
  ],
  remember: "Find each side's best replies. Where both rings meet, nobody moves.",
  practice: "Traffic habits, standards, prices and bidding strategies settle where no one gains by deviating. An equilibrium is stable, not necessarily good: the Prisoner's Dilemma has one that hurts both.",
  origin: "John Nash proved in 1950 that every finite game has an equilibrium, if mixed strategies are allowed. It generalises Cournot's earlier idea of a stable output choice.",
};

export const nashEquilibrium: GameModule = {
  slug: "nash-equilibrium",
  hook: "Where does nobody want to move?",
  create: (env) => new NashEquilibriumGame(env),
  theory,
};
