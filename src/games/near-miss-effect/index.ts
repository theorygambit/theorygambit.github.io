import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { NearMissEffectGame } from "./NearMissEffectGame";

const theory: TheoryEntry = {
  idea: "Almost winning feels like progress and pulls people to play more than a clear loss does. But each spin is drawn fresh, so a near miss tells you nothing about the next spin.",
  taught: [
    { beat: "Feel", text: "A three reel machine. Spin or stop, up to eight times, and watch your coins against never having played." },
    { beat: "See", text: "How often you went on after a near miss and after a plain loss, against the chance the next spin wins." },
    { beat: "Prove", text: "Two new machines, each showing a near miss. Spin again or stop, by the average payoff." },
  ],
  math: [
    { label: "Average per spin", expr: "EV = p × prize - cost" },
    { label: "This machine", expr: "0.10 × 6 - 1 = -0.4" },
    { label: "After any spin", expr: "P(win next) = p, whatever the reels showed" },
  ],
  remember: "A near miss is a loss that feels like progress.",
  practice: "Slot machines, scratch cards, loot boxes, and games that show how close you were. Designers add near misses on purpose, because they raise play without raising payouts. Judge any such game by its average, not by how close it felt.",
  origin: "Clark and colleagues (2009) found that near misses activate reward circuits in the brain, even though they are losses. Skinner's work on reinforcement schedules showed the same pull in animals.",
};

export const nearMissEffect: GameModule = {
  slug: "near-miss-effect",
  hook: "Why does almost winning make us play again?",
  create: (env) => new NearMissEffectGame(env),
  theory,
};
