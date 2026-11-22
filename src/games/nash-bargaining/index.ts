import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { NashBargainingGame } from "./NashBargainingGame";

const theory: TheoryEntry = {
  idea: "Two players can share a pot or walk away with fallbacks. The Nash bargaining solution picks the split that maximises the product of each player's gain over their fallback. With a fixed pot, that means splitting the gain in half and adding each side's fallback.",
  taught: [
    { beat: "Feel", text: "Offer a split. They accept only a fair share of the gain over walking away." },
    { beat: "See", text: "Drag your share on a plot of the product of gains and find where it peaks." },
    { beat: "Prove", text: "New fallbacks and pots. Find your Nash share." },
  ],
  math: [
    { label: "Maximise the product of gains", expr: "(x1 - d1)(x2 - d2)" },
    { label: "Fixed pot T", expr: "x1 = d1 + (T - d1 - d2) / 2" },
    { label: "A better fallback", expr: "raises your share by half of its gain" },
  ],
  remember: "Split what you gain from agreeing, not the whole pot.",
  practice: "Wage talks, supplier deals, and any negotiation where each side has a walk-away option.",
  origin: "John Nash, 1950.",
};

export const nashBargaining: GameModule = { slug: "nash-bargaining", hook: "How should two parties split a deal?", create: (env) => new NashBargainingGame(env), theory };
