import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { EssGame } from "./EssGame";

const theory: TheoryEntry = {
  idea: "A strategy is evolutionarily stable if, once nearly everyone plays it, a rare mutant playing something else earns less. It is a stricter test than Nash equilibrium: it asks the strategy to survive invasion, not only to be a best reply.",
  taught: [
    { beat: "Feel", text: "Let hawks rule, then doves, and drop one mutant into each crowd. See who earns more." },
    { beat: "See", text: "Compare, in each column of the table, what the resident earns against itself and what the mutant earns against it." },
    { beat: "Prove", text: "Two new tables. Tap every strategy that resists invasion." },
  ],
  math: [
    { label: "Payoff u(i, j)", expr: "what strategy i earns against strategy j" },
    { label: "Resident i resists mutant j when", expr: "u(i, i) > u(j, i)" },
    { label: "Tie case", expr: "if u(i, i) = u(j, i), then it needs u(i, j) > u(j, j)" },
    { label: "ESS implies Nash", expr: "every ESS is a symmetric Nash equilibrium, but not every equilibrium is an ESS" },
  ],
  remember: "Compare what a common strategy earns against itself with what a rare mutant earns against it.",
  practice: "Animal contests, social norms and market conventions persist when invaders cannot profit. When no pure strategy resists, a stable mix can exist, as in Hawk and Dove.",
  origin: "John Maynard Smith and George Price defined the ESS in 1973. It gave evolutionary biology a game theory language and led to replicator dynamics.",
};

export const ess: GameModule = {
  slug: "ess",
  hook: "Can a rare mutant do better?",
  create: (env) => new EssGame(env),
  theory,
};
