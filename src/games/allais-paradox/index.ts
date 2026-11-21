import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { AllaisParadoxGame } from "./AllaisParadoxGame";

const theory: TheoryEntry = {
  idea: "Offered a sure prize against a gamble with a higher average, most people take the sure thing. Offered the same pair with a common chance of the same outcome stripped away, most people switch to the gamble. No expected utility function can explain both choices.",
  taught: [
    { beat: "Feel", text: "Two choices: a sure million against a gamble, then two long shots. Notice which you pick." },
    { beat: "See", text: "Strip the shared 89 percent from both pairs. What is left is the same choice, so the answers should match." },
    { beat: "Prove", text: "New prizes and chances. Given the first pick, tap the second pick that expected utility requires." },
  ],
  math: [
    { label: "Pair one", expr: "A: s for sure. B: s with chance c, h with pH, 0 with pZ" },
    { label: "Pair two", expr: "C: s with chance pH + pZ, else 0. D: h with chance pH, else 0" },
    { label: "Common part", expr: "pair one shares a chance c of s, pair two a chance c of 0, with c = 1 - pH - pZ" },
    { label: "Independence", expr: "removing a common part cannot change the preference, so A goes with C and B with D" },
  ],
  remember: "Strip what both options share. Expected utility says the choice should not change.",
  practice: "People overvalue certainty, which shapes insurance, warranties and why sure discounts beat risky bigger ones. Framing the same choice with a shared common part can flip answers.",
  origin: "Maurice Allais posed the paradox in 1953. It was a founding challenge to expected utility, and led to prospect theory and other models of choice.",
};

export const allaisParadox: GameModule = {
  slug: "allais-paradox",
  hook: "A sure thing, or a better gamble?",
  create: (env) => new AllaisParadoxGame(env),
  theory,
};
