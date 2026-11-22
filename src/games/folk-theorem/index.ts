import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { FolkTheoremGame } from "./FolkTheoremGame";

const theory: TheoryEntry = {
  idea: "In an endlessly repeated game with patient players, almost any outcome can be sustained, so long as it is reachable by mixing and gives each player more than the worst the other could force on them. The threat of punishment holds the deal together.",
  taught: [
    { beat: "Feel", text: "Drag a payoff pair around a repeated prisoner's dilemma and test whether patient players could sustain it." },
    { beat: "See", text: "Build the picture in three taps: the reachable shape, the punishment lines, and the region that survives both." },
    { beat: "Prove", text: "New payoffs. For each point, answer whether it can be sustained." },
  ],
  math: [
    { label: "Feasible payoffs", expr: "every average of the four outcomes, the hull of (S, T), (R, R), (T, S), (P, P)" },
    { label: "Punishment level", expr: "the least the other can hold you to, here P" },
    { label: "Individually rational", expr: "both players get more than P" },
    { label: "Folk theorem", expr: "feasible and individually rational payoffs are equilibria when players are patient enough" },
  ],
  remember: "Reachable and above the threat level for both: then a patient pair can hold it.",
  practice: "Cartels, trade deals and norms hold because breaking them triggers punishment. The same logic means bad outcomes can also be sustained, as long as both beat the worst case.",
  origin: "The folk theorem was known in game theory circles before anyone published it, hence the name. Fudenberg and Maskin proved the full version in 1986.",
};

export const folkTheorem: GameModule = {
  slug: "folk-theorem",
  hook: "Almost any deal can hold, if the threat is real.",
  create: (env) => new FolkTheoremGame(env),
  theory,
};
