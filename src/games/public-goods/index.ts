import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { PublicGoodsGame } from "./PublicGoodsGame";

const theory: TheoryEntry = {
  idea: "A shared pot grows what everyone puts in, and the gain is split equally. Each person gets back only a fraction of what they give, so keeping everything is tempting, yet if all give, everyone is better off.",
  taught: [
    { beat: "Feel", text: "Three rounds. Choose how many of ten tokens go in the pot, and see what giving nothing would have paid you." },
    { beat: "See", text: "Drag your gift. Your own payoff falls by half a token per token given, while the group gains one." },
    { beat: "Prove", text: "New group sizes. Drag the multiplier to where giving stops costing you." },
  ],
  math: [
    { label: "Your payoff", expr: "10 - g + (r / n) x (all gifts)" },
    { label: "One more token costs you", expr: "1 - r / n" },
    { label: "Giving pays you only if", expr: "r / n > 1, that is r > n" },
    { label: "The group gains per token", expr: "r - 1, positive whenever r > 1" },
  ],
  remember: "Each token returns r over n to you, but r to the group. Free riding is tempting.",
  practice: "Shared tools, clean air, team projects and public radio all work this way. Rules, reputation and repeated contact are how groups keep contributions up.",
  origin: "Public goods games are a staple of experimental economics. People give about half at first, then give less as they see others free ride, unless punishment or communication is allowed.",
};

export const publicGoods: GameModule = {
  slug: "public-goods",
  hook: "Why give to the pot when others will?",
  create: (env) => new PublicGoodsGame(env),
  theory,
};
