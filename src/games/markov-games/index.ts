import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MarkovGamesGame } from "./MarkovGamesGame";

const theory: TheoryEntry = {
  idea: "In a Markov game the world has states, and the chance of the next state depends only on the current state and the actions taken now. Past history matters only through where you are. Over a long time, the share of rounds spent in each state settles.",
  taught: [
    { beat: "Feel", text: "Six rounds in a Good or Bad state. Invest or coast, and see how each choice moves the chance of being Good next." },
    { beat: "See", text: "Drag how often you invest. The long-run share of rounds in the Good state climbs, though investing has a cost." },
    { beat: "Prove", text: "A new chain. Drag to the long-run share of time in the Good state." },
  ],
  math: [
    { label: "Transitions", expr: "from Good, chance p of falling to Bad. From Bad, chance q of climbing to Good" },
    { label: "Balance", expr: "in the long run, share Good x p = share Bad x q" },
    { label: "Long-run share Good", expr: "q / (p + q)" },
    { label: "Average payoff", expr: "weight each state's payoff by its long-run share, minus the cost of acting" },
  ],
  remember: "Long-run share in a state comes from balancing the flows in and out.",
  practice: "Customer retention, inventory, health and market cycles are Markov chains with choices. Stochastic games add rivals whose actions shift the same transition chances.",
  origin: "Shapley introduced stochastic games in 1953, the same year as his value for cooperative games. They underlie dynamic programming and reinforcement learning.",
};

export const markovGames: GameModule = {
  slug: "markov-games",
  hook: "Where do you spend your time in the long run?",
  create: (env) => new MarkovGamesGame(env),
  theory,
};
