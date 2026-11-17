import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { UltimatumGame } from "./UltimatumGame";

const theory: TheoryEntry = {
  idea: "A proposer splits a sum and the responder can accept or refuse, in which case both get nothing. Pure self interest says offer the minimum. Real people refuse unfair offers, so the best offer sits where fairness and greed balance.",
  taught: [
    { beat: "Feel", text: "Five responders with private minimums. Split 10 coins and see who refuses." },
    { beat: "See", text: "The crowd's acceptance curve and your expected earnings. Drag a probe to find the peak." },
    { beat: "Prove", text: "Two new crowds. Pick the offer that earns the most on average, without seeing your earnings curve." },
  ],
  math: [
    { label: "Subgame perfect prediction", expr: "Offer the smallest unit, responder accepts any x > 0" },
    { label: "With acceptance probability A(x) for an offer x out of 10", expr: "E(x) = (10 - x) * A(x)" },
    { label: "A bell shaped crowd with mean m and spread s", expr: "A(x) = Phi((x - m) / s)" },
    { label: "Best offer", expr: "x* maximises E(x). Raise x until the extra chance of a yes no longer pays for the coin given up." },
  ],
  remember: "The best offer depends on how much unfairness the other side will take.",
  practice: "Salary offers, pricing, negotiations and platform fees all hide a refusal threshold. Offering the legal minimum often triggers refusal, protest or churn. Learn the crowd, then stay just inside what it tolerates.",
  origin: "Introduced by Werner Guth, Rolf Schmittberger and Bernd Schwarze in 1982. A central experiment in behavioural game theory.",
};

export const ultimatum: GameModule = {
  slug: "ultimatum",
  hook: "Why fairness beats the textbook answer.",
  create: (env) => new UltimatumGame(env),
  theory,
};
