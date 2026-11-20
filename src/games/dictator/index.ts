import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { DictatorGame } from "./DictatorGame";

const theory: TheoryEntry = {
  idea: "One person decides how to split a sum and the other has no say. Because nothing can punish a small gift, what they give measures pure generosity, with fear of refusal taken out.",
  taught: [
    { beat: "Feel", text: "Split 10 coins with a stranger who cannot answer. Then split 10 more with one who can refuse." },
    { beat: "See", text: "Your two offers side by side. What you gave with no say is the gift. The extra in the second game is fear." },
    { beat: "Prove", text: "Two new pairs of people, each with both numbers. Tap the one who is kinder." },
  ],
  math: [
    { label: "Dictator gift", expr: "g = what you give when the other has no say" },
    { label: "Ultimatum offer", expr: "u = what you offer when the other can refuse" },
    { label: "Generosity and fear", expr: "generosity = g, fear = max(0, u - g)" },
    { label: "The selfish prediction", expr: "dictator gives 0, proposer offers the smallest accepted amount" },
  ],
  remember: "Generosity is what you give when nobody can make you.",
  practice: "Charity, tipping, anonymous donations, wage setting and any design that lets one side decide for another. When you measure kindness, remove the threat of a response first.",
  origin: "Forsythe, Horowitz, Savin and Sefton (1994) ran it to test whether Ultimatum offers came from fairness or from fear. Most people gave something, but less than in the Ultimatum game.",
};

export const dictator: GameModule = {
  slug: "dictator",
  hook: "What do you give when nobody can answer back?",
  create: (env) => new DictatorGame(env),
  theory,
};
