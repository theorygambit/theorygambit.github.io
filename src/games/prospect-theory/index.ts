import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ProspectTheoryGame } from "./ProspectTheoryGame";

const theory: TheoryEntry = {
  idea: "People judge outcomes as gains and losses from a reference point, not as final wealth, and a loss weighs more than an equal gain. A fair coin flip with a bigger win than loss can still feel like a bad deal.",
  taught: [
    { beat: "Feel", text: "Four coin flips that all pay off on average. Take it or pass, and see how each one felt." },
    { beat: "See", text: "Drag along the value line. The loss side is steeper, so a loss of x feels twice as big as a gain of x." },
    { beat: "Prove", text: "A new loss and a new weight. Drag to the gain that makes the flip feel neutral." },
  ],
  math: [
    { label: "Value of a gain or loss x", expr: "v(x) = x if x >= 0, and v(x) = lambda x if x < 0" },
    { label: "Loss aversion", expr: "lambda is about 2, so a loss feels twice a gain" },
    { label: "Felt value of a fair flip", expr: "0.5 v(gain) + 0.5 v(-loss)" },
    { label: "Break even gain", expr: "gain = lambda x loss" },
  ],
  remember: "Losses loom larger than gains. A bet must win about twice what it risks.",
  practice: "Prices framed as discounts or fees, defaults, and why people hold losing investments all lean on loss aversion. Anchors and reference points matter as much as the amounts.",
  origin: "Kahneman and Tversky's 1979 prospect theory replaced expected utility as a description of choice. Kahneman won the 2002 Nobel prize.",
};

export const prospectTheory: GameModule = {
  slug: "prospect-theory",
  hook: "Why does losing 50 hurt more than winning 50 pleases?",
  create: (env) => new ProspectTheoryGame(env),
  theory,
};
