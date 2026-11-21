import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { PreferenceManipulationGame } from "./PreferenceManipulationGame";

const theory: TheoryEntry = {
  idea: "Preferences are built at the moment of choice, from what is on the menu. A decoy that is worse than one option, and no worse or better than the other in an obvious way, makes the first option look better and shifts what people pick, though nobody wants the decoy.",
  taught: [
    { beat: "Feel", text: "Choose between two options, then choose again when a third appears. Notice whether your pick moved." },
    { beat: "See", text: "Tap each option to see who beats it outright. The decoy is beaten by exactly one option." },
    { beat: "Prove", text: "New options with new labels. Tap the decoy." },
  ],
  math: [
    { label: "Dominates", expr: "a beats b if a is no worse on price and quality, and better on at least one" },
    { label: "Asymmetric dominance", expr: "the decoy is beaten by one option and not by the other" },
    { label: "Effect", expr: "the option that beats the decoy gains share, with no change in its own price or quality" },
    { label: "Rational check", expr: "a menu item that is never chosen should not change the choice among the rest" },
  ],
  remember: "A decoy no one picks can still decide the pick. Find what beats it.",
  practice: "Pricing tiers, subscription menus and product lines use decoys, anchors and framing on purpose. Seeing the structure helps you choose the option you actually prefer.",
  origin: "Huber, Payne and Puto described the attraction effect in 1982. Ariely popularised it, and it is a standard example of context dependent choice.",
};

export const preferenceManipulation: GameModule = {
  slug: "preference-manipulation",
  hook: "A choice nobody takes can still change your mind.",
  create: (env) => new PreferenceManipulationGame(env),
  theory,
};
