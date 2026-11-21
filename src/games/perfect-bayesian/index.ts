import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { PerfectBayesianGame } from "./PerfectBayesianGame";

const theory: TheoryEntry = {
  idea: "When a move can signal a hidden type, listeners update their beliefs by Bayes' rule, using what each type would do. A perfect Bayesian equilibrium needs every move to be a best reply to those beliefs, and every belief to match the strategies wherever it can.",
  taught: [
    { beat: "Feel", text: "An applicant shows a degree or not. Hire or pass four times, and see who the signal comes from." },
    { beat: "See", text: "Tap each signal. Strong types send it more often, so it shifts the odds." },
    { beat: "Prove", text: "New rates. Drag the share of strong senders among those who sent the signal." },
  ],
  math: [
    { label: "Share strong given the signal", expr: "p s / (p s + (1 - p) w)" },
    { label: "Without the signal", expr: "p (1 - s) / (p (1 - s) + (1 - p) (1 - w))" },
    { label: "Hire when", expr: "posterior x payoff when strong > payoff of passing" },
  ],
  remember: "A signal is worth what it reveals. Count who would send it, then take the share that are strong.",
  practice: "Degrees and job offers, warranties on used goods, a startup's funding round, a seller who pays for ads.",
  origin: "Michael Spence, 1973, on job market signaling. Perfect Bayesian equilibrium was developed in the 1980s by Kreps, Wilson and others.",
};

export const perfectBayesian: GameModule = { slug: "perfect-bayesian", hook: "What does a signal tell you?", create: (env) => new PerfectBayesianGame(env), theory };
