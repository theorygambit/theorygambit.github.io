import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { CommitmentCredibilityGame } from "./CommitmentCredibilityGame";

const theory: TheoryEntry = {
  idea: "Binding yourself can make you stronger, because it removes your own option to back down. A threat is believed only if carrying it out is what you would want to do when the moment comes.",
  taught: [
    { beat: "Feel", text: "You are the incumbent and a rival may enter. Threaten to fight for free, or commit to fighting at a cost." },
    { beat: "See", text: "Work backwards from the end. Your threat is empty, so they come in, until you cut the branch that makes it empty." },
    { beat: "Prove", text: "Three new cases. Commit, or not: sometimes the threat is already believed, sometimes the commitment costs too much." },
  ],
  math: [
    { label: "A threat is credible if", expr: "your payoff from fighting > your payoff from accommodating" },
    { label: "A rival enters if", expr: "what they expect after entering > what staying out pays them" },
    { label: "Commit if", expr: "(payoff with them out) - (cost of committing) > (payoff you get anyway)" },
  ],
  remember: "A threat you would not carry out is just talk.",
  practice: "Burning bridges, public deadlines, contracts with penalties, automatic responses, delegating to a hard-nosed negotiator, and most-favoured-customer clauses. Commitments work only when they are visible and costly to reverse.",
  origin: "Thomas Schelling, The Strategy of Conflict (1960), on commitment and credibility. Reinhard Selten's chain store paradox shows why an empty threat fails under backward induction.",
};

export const commitmentCredibility: GameModule = {
  slug: "commitment-credibility",
  hook: "Why does losing an option make you stronger?",
  create: (env) => new CommitmentCredibilityGame(env),
  theory,
};
