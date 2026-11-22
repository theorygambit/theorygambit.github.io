import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { QuantalResponseGame } from "./QuantalResponseGame";

const theory: TheoryEntry = {
  idea: "Players pick better moves more often but not always. The chance of a move rises smoothly with its payoff advantage, and noise matters less as the gap grows. A quantal response equilibrium is where everyone's noisy choices are consistent with everyone else's.",
  taught: [
    { beat: "Feel", text: "Bet on a noisy rival picking the better move, or take a safe prize." },
    { beat: "See", text: "Drag the payoff gap. The chance of the better move rises smoothly, never to certain." },
    { beat: "Prove", text: "New gaps and sharpness. Find the chance in percent." },
  ],
  math: [
    { label: "Logit choice", expr: "P(better) = 1 / (1 + e^(-lambda x gap))" },
    { label: "lambda = 0", expr: "50 percent, pure noise" },
    { label: "lambda large", expr: "nearly always the better move" },
  ],
  remember: "Errors are not random: costly mistakes are rarer than cheap ones.",
  practice: "Predicting real players, setting bot skill, and fitting game theory to lab data where best response fails.",
  origin: "Richard McKelvey and Thomas Palfrey, 1995.",
};

export const quantalResponse: GameModule = { slug: "quantal-response", hook: "What if players only usually choose the best move?", create: (env) => new QuantalResponseGame(env), theory };
