import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ExpectedUtilityGame } from "./ExpectedUtilityGame";

const theory: TheoryEntry = {
  idea: "A rational chooser does not compare average money. They compare average utility, where each extra coin is worth less than the one before. A gamble can have the higher average and still be worth less than a smaller sure amount.",
  taught: [
    { beat: "Feel", text: "Four sure amounts against the same coin flip for 100. The average money always favours the flip. Where do you stop gambling?" },
    { beat: "See", text: "The utility curve is bent. The flip sits on a chord below it, so it is worth 25 for sure, not 50." },
    { beat: "Prove", text: "Two new gambles. Drag the sure amount until its utility disc matches the gamble's ring." },
  ],
  math: [
    { label: "Utility here", expr: "u(x) = √x" },
    { label: "Expected utility of the flip", expr: "EU = 0.5 × √100 + 0.5 × √0 = 5" },
    { label: "Certainty equivalent", expr: "u(CE) = EU, so CE = EU² = 25" },
    { label: "Compared with the average", expr: "EV = 50. CE < EV whenever u is bent like this" },
  ],
  remember: "Weigh utility, not coins.",
  practice: "Insurance, diversification, pricing risk, negotiating a sure offer against a lottery and choosing a job with uncertain pay. A concave utility explains why people pay to avoid risk, and a convex one would explain why some seek it.",
  origin: "Daniel Bernoulli (1738) solved the St Petersburg paradox with a utility that grows slower than money. John von Neumann and Oskar Morgenstern (1944) gave expected utility its axioms.",
};

export const expectedUtility: GameModule = {
  slug: "expected-utility",
  hook: "Is a coin flip for 100 worth 50?",
  create: (env) => new ExpectedUtilityGame(env),
  theory,
};
