import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { CournotGame } from "./CournotGame";

const theory: TheoryEntry = {
  idea: "Two firms choose how much to sell at the same time, and the price falls as the total grows. Each firm's best quantity is half of what the rival leaves, and the two replies cross at one point where neither wants to change.",
  taught: [
    { beat: "Feel", text: "Choose a quantity for five rounds against a rival who answers what you sold last time." },
    { beat: "See", text: "Step the two best replies and watch them walk to the point where they cross." },
    { beat: "Prove", text: "New prices and costs. Drag the point to where neither firm wants to change." },
  ],
  math: [
    { label: "Price falls with the total, a cost c is paid per unit", expr: "profit = q (a - q - q' - c)" },
    { label: "Best reply to a rival selling q'", expr: "q = (a - c - q') / 2" },
    { label: "Both replies at once, equal costs", expr: "q = (a - c) / 3 each" },
  ],
  remember: "Each firm sells half of what the other leaves. Together they sell more than a monopoly would, so each earns less.",
  practice: "Oil producers, airlines on one route, farmers deciding how much to plant, and any market where firms set capacity at the same time. Holding back together pays more, but each firm gains by selling a bit extra.",
  origin: "Augustin Cournot, 1838. The first model of a market with a small number of firms.",
};

export const cournot: GameModule = { slug: "cournot", hook: "How much do you sell when the rival does too?", create: (env) => new CournotGame(env), theory };
