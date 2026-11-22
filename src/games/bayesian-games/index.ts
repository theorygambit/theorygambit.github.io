import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { BayesianGamesGame } from "./BayesianGamesGame";

const theory: TheoryEntry = {
  idea: "In a Bayesian game each player has a private type that others cannot see. A strategy must be the best reply given beliefs about the other player's type. The belief, as much as the payoffs, decides what is rational.",
  taught: [
    { beat: "Feel", text: "Four entry decisions against an incumbent who is Tough or Weak. Your belief changes each time." },
    { beat: "See", text: "Drag the belief and watch the average payoff of entering cross zero at one belief." },
    { beat: "Prove", text: "New payoffs. Drag to the belief where entering and staying out are equally good." },
  ],
  math: [
    { label: "Entry payoffs", expr: "G against a Weak incumbent, -L against a Tough one, 0 for staying out" },
    { label: "Belief q", expr: "the chance the incumbent is Tough" },
    { label: "Expected payoff of entering", expr: "G (1 - q) - L q" },
    { label: "Threshold", expr: "enter when q < G / (G + L)" },
  ],
  remember: "Best reply to a belief. Enter only when the chance of a Tough rival is low enough.",
  practice: "Entry, bidding, hiring and negotiation all involve private information. How you reason depends on what you believe, and what others believe you believe.",
  origin: "Harsanyi's 1967 work turned incomplete information into a game with a chance move that picks types. He shared the 1994 Nobel prize for it.",
};

export const bayesianGames: GameModule = {
  slug: "bayesian-games",
  hook: "What do you believe about a rival you cannot see?",
  create: (env) => new BayesianGamesGame(env),
  theory,
};
