import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ShapleyValueGame } from "./ShapleyValueGame";

const theory: TheoryEntry = {
  idea: "Pay each player the average of what they add to the group, over every order in which the group could have formed. It is the only split that is fair to symmetric players, wastes nothing, adds up across games, and gives nothing to a player who adds nothing.",
  taught: [
    { beat: "Feel", text: "You are paid what you add when you join. Join first or join last." },
    { beat: "See", text: "Tap the six join orders to see what A adds in each, then average them." },
    { beat: "Prove", text: "New coalition values. Find A's average contribution." },
  ],
  math: [
    { label: "Marginal contribution", expr: "v(S + i) - v(S)" },
    { label: "Shapley value", expr: "phi_i = average of the marginal contributions over all join orders" },
    { label: "Three players", expr: "average over 6 orders" },
  ],
  remember: "Your share is your average contribution, not your best and not your worst.",
  practice: "Splitting profit, cost and credit among partners, and explaining what each input adds to a model prediction.",
  origin: "Lloyd Shapley, 1953.",
};

export const shapleyValue: GameModule = { slug: "shapley-value", hook: "What is each player's fair share?", create: (env) => new ShapleyValueGame(env), theory };
