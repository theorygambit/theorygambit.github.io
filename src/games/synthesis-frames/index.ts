import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { SynthesisFramesGame } from "./SynthesisFramesGame";

const theory: TheoryEntry = {
  idea: "Hidden types, messages and levels of reasoning meet in one board. A seller is strong or weak, and a weak one may announce itself as strong. Whether the announcement means anything depends on how far the seller reasons, which is part of the picture each side holds. To read a message, update on the prior and on who is speaking.",
  taught: [
    { beat: "Feel", text: "A seller says Premium. Buy or pass, knowing how many sellers are strong and how this one behaves." },
    { beat: "See", text: "Tap each kind of seller. The same word is worth different amounts at different levels." },
    { beat: "Prove", text: "From a prior and a bluff rate, find how likely a Premium seller is strong." },
  ],
  math: [
    { label: "Bayes after hearing Premium", expr: "P(strong | Premium) = p / (p + (1 - p) b)" },
    { label: "Naive seller, b = 1", expr: "the message says nothing: P = p" },
    { label: "Honest seller, b = 0", expr: "the message is proof: P = 1" },
  ],
  remember: "What a message means depends on what the sender knows the receiver will do with it.",
  practice: "Reading reviews, ads, job market signals and pitches, where the sender anticipates your reading.",
  origin: "Mixes hypergames (Bennett), level-k reasoning (Nagel), signaling (Spence) and Bayesian games (Harsanyi).",
};

export const synthesisFrames: GameModule = { slug: "synthesis-frames", hook: "What if beliefs, types and levels all collide?", create: (env) => new SynthesisFramesGame(env), theory };
