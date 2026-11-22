import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MultipolarTrapsGame } from "./MultipolarTrapsGame";

const theory: TheoryEntry = {
  idea: "Many rivals compete for a fixed prize, and each must raise their effort or fall behind. Everyone raises, shares return to where they started, and the cost is pure waste. No one can stop alone.",
  taught: [
    { beat: "Feel", text: "Five rivals share a pie by level. Raise yours for a cost, or hold. Rivals copy anyone who raised." },
    { beat: "See", text: "Your net each round against the fair share, and the cost everyone paid for nothing." },
    { beat: "Prove", text: "Two new contests. Drag the cost until raising alone stops paying." },
  ],
  math: [
    { label: "Your share", expr: "pie × (1 + yours) / Σ (1 + theirs)" },
    { label: "Everyone holding", expr: "pie / n each" },
    { label: "Raising alone", expr: "pie × 2 / (n + 1) - cost" },
    { label: "Break even cost", expr: "pie (n - 1) / (n (n + 1)). Below it, raising pays and everyone does it." },
  ],
  remember: "When each must keep up, all spend and nobody gains.",
  practice: "Arms races, advertising wars, credential inflation, speed-to-market races and bidding for talent. The exit is rarely one player stopping. It is a rule that raises the price of escalating for all of them at once.",
  origin: "Scott Alexander's essay Meditations on Moloch (2014) named such situations, and Daniel Schmachtenberger and others use the term multipolar trap. It is the many-player cousin of the Prisoner's Dilemma and the Tragedy of the Commons.",
};

export const multipolarTraps: GameModule = {
  slug: "multipolar-traps",
  hook: "Why does everyone race when nobody wants to?",
  create: (env) => new MultipolarTrapsGame(env),
  theory,
};
