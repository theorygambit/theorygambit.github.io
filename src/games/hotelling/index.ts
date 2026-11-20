import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { HotellingGame } from "./HotellingGame";

const theory: TheoryEntry = {
  idea: "Two sellers choose where to stand on a street and each customer walks to the nearer one. Whoever stands beside the rival on the side with more customers gains, so both drift to the middle customer.",
  taught: [
    { beat: "Feel", text: "Four rounds. Place a shop, see who the customers choose, then watch the rival step in beside you." },
    { beat: "See", text: "Tap Move and watch the shops leapfrog, each beside the other, until both stand in the middle." },
    { beat: "Prove", text: "Two streets where the crowd is packed to one side. Drag to where both shops will settle." },
  ],
  math: [
    { label: "Customers held by a shop at a against a rival at b", expr: "the customers nearer to a than to b, ties split" },
    { label: "Best reply to a rival at b", expr: "stand just beside b, on the side with more customers" },
    { label: "Equilibrium", expr: "both shops at the median customer: half of the customers on each side" },
  ],
  remember: "Rivals end at the middle customer, not the middle of the map.",
  practice: "Shops, parties and products drift toward the same middle: two petrol stations on one corner, two parties with the same platform, two apps with the same features. Moving apart leaves the middle to the rival.",
  origin: "Harold Hotelling, 1929, Stability in Competition. Often used to explain why rivals look alike, and the median voter result in politics.",
};

export const hotelling: GameModule = { slug: "hotelling", hook: "Why rivals end up side by side.", create: (env) => new HotellingGame(env), theory };
