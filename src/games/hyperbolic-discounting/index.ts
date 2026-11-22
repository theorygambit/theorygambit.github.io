import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { HyperbolicDiscountingGame } from "./HyperbolicDiscountingGame";

const theory: TheoryEntry = {
  idea: "We overvalue now relative to later, and our tradeoffs flip as a reward gets close. The same choice between a smaller reward and a larger one made later is made the other way when the smaller reward is about to arrive.",
  taught: [
    { beat: "Feel", text: "A smaller reward sooner or a larger one later, twice near and twice far, with the same gap of weeks." },
    { beat: "See", text: "Drag the delay of the sooner reward. The two present values cross, and the choice flips." },
    { beat: "Prove", text: "Two new offers. Drag the delay to where the choice flips." },
  ],
  math: [
    { label: "Hyperbolic value", expr: "V = A / (1 + k d)" },
    { label: "Sooner S at week t, later L at t + g", expr: "S / (1 + k t) against L / (1 + k (t + g))" },
    { label: "The flip", expr: "t* = S g / (L - S) - 1 / k" },
    { label: "A steady discounter", expr: "V = A δ^d never flips, because the ratio of the two values does not depend on t" },
  ],
  remember: "The same choice flips as the reward gets close.",
  practice: "Saving, dieting, deadlines, subscriptions and free trials. Commitment devices help because they decide for the far-off self: automatic saving, a gym booked in advance, or a purchase that is hard to undo.",
  origin: "George Ainslie (1975) and later David Laibson (1997). Experiments find that people choose the larger later reward when both are far off, and the smaller sooner one when it is immediate.",
};

export const hyperbolicDiscounting: GameModule = {
  slug: "hyperbolic-discounting",
  hook: "Why do we choose differently when it is close?",
  create: (env) => new HyperbolicDiscountingGame(env),
  theory,
};
