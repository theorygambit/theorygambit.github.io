import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { FocalPointsGame } from "./FocalPointsGame";

const theory: TheoryEntry = {
  idea: "When you cannot talk, you pick the option that stands out and hope the other person does too. Something that looks unlike the rest becomes the obvious answer for both of you.",
  taught: [
    { beat: "Feel", text: "Four rows of options. Pick the one a stranger will pick, with no way to talk." },
    { beat: "See", text: "A hundred strangers go into each row. Where nothing stands out they scatter, where one does they gather." },
    { beat: "Prove", text: "Three new rows, one with a trap. Tap the option most strangers would pick." },
  ],
  math: [
    { label: "Salience of an option", expr: "1 / (number of options that look like it)²" },
    { label: "Share of the crowd on option i", expr: "sᵢ = salience(i) / Σ salience" },
    { label: "Chance two strangers match", expr: "Σ sᵢ²" },
  ],
  remember: "Without talking, people meet on whatever stands out.",
  practice: "Meeting points, default settings, round numbers, tied bids and standards all work this way. A designer who wants coordination makes one option stand out. A designer who wants a fair choice removes the standout.",
  origin: "Thomas Schelling, The Strategy of Conflict (1960). He asked people where they would meet a stranger in New York with no time set, and most said the same place.",
};

export const focalPoints: GameModule = {
  slug: "focal-points",
  hook: "What do two strangers pick without a word?",
  create: (env) => new FocalPointsGame(env),
  theory,
};
