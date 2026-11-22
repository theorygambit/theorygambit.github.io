import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { SpitefulPreferencesGame } from "./SpitefulPreferencesGame";

const theory: TheoryEntry = {
  idea: "A spiteful player's payoff falls when yours rises. They will pay a cost to hurt you when the harm, weighted by their spite, is worth more than the cost. Spite breaks the usual assumption that more for others never hurts you.",
  taught: [
    { beat: "Feel", text: "Pay a cost to cut their payoff, or keep both. You are spiteful." },
    { beat: "See", text: "Drag your spite. Burning only feels better above one level." },
    { beat: "Prove", text: "New costs and harms. Find the spite at which harming just pays." },
  ],
  math: [
    { label: "Spiteful utility", expr: "U = own - s x other" },
    { label: "Pay c to cut their payoff by h when", expr: "s x h > c" },
    { label: "Threshold", expr: "s = c / h" },
  ],
  remember: "Spite can be priced: raise the cost of harm and the spiteful stop paying.",
  practice: "Sabotage in contests, griefing in games, and why some players refuse deals that make a rival richer.",
  origin: "Spite in economics, after Hamilton, 1970, and Levine, 1998.",
};

export const spitefulPreferences: GameModule = { slug: "spiteful-preferences", hook: "What if you gain when others lose?", create: (env) => new SpitefulPreferencesGame(env), theory };
