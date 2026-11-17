import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MatchingPenniesGame } from "./MatchingPenniesGame";

const theory: TheoryEntry = {
  idea: "When any pattern in your play can be exploited, the only safe strategy is to randomise, mixing your choices so the other side cannot do better than chance.",
  taught: [
    { beat: "Feel", text: "Sixteen rounds against a pattern reader. A ring around your disc means it guessed you." },
    { beat: "See", text: "Your own numbers: how often you leaned, how you repeated, and the tent that peaks at 50/50." },
    { beat: "Prove", text: "Let chance play for you. A thousand round run shows the reader settling at one half." },
  ],
  math: [
    { label: "Payoffs", expr: "Matcher wins +1 on a match, you win +1 on a mismatch. Zero sum." },
    { label: "Your expected score if you play Left with probability p, against a best reply", expr: "-|2p - 1|" },
    { label: "Mixed equilibrium", expr: "p = 1/2 for both players, value 0" },
    { label: "Why", expr: "At p = 1/2 each pure move has the same expected payoff, so neither side gains by deviating" },
  ],
  remember: "If you can be read, you will be used. Mix so you cannot be.",
  practice: "Penalty kicks, serving in tennis, poker bluffs, audits and security patrols all need unpredictability. People are poor at faking randomness, so use a real random source when the stakes are real.",
  origin: "A cornerstone of zero sum theory. Von Neumann's minimax theorem (1928) guarantees a mixed equilibrium in every finite zero sum game.",
};

export const matchingPennies: GameModule = {
  slug: "matching-pennies",
  hook: "Why being predictable always costs you.",
  create: (env) => new MatchingPenniesGame(env),
  theory,
};
