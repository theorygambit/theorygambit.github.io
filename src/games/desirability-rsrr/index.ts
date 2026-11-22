import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { DesirabilityRsrrGame } from "./DesirabilityRsrrGame";

const theory: TheoryEntry = {
  idea: "Score how often a person is chosen by others and use it to rank and match. Asking someone far above your score rarely works, and asking someone far below wastes the chance, so the best asks are near your own level. Beware the feedback loop: whoever is shown more is chosen more, which raises their score and gets them shown more.",
  taught: [
    { beat: "Feel", text: "You have a desirability score. Ask someone near you or someone far above." },
    { beat: "See", text: "Drag how desirable they are. The payoff peaks near your own level." },
    { beat: "Prove", text: "New scores. Find the chance they accept." },
  ],
  math: [
    { label: "Chance of yes", expr: "1 - max(0, them - you) / 30, within 0 and 1" },
    { label: "Expected worth", expr: "their score x chance of yes" },
    { label: "Fair exposure", expr: "show some less-seen profiles so scores can correct" },
  ],
  remember: "A score is a record of who was shown, not only of who is good.",
  practice: "Matching in games, dating and hiring, and ranking systems that must not lock in early winners.",
  origin: "Rating and reciprocity ideas from Elo, 1978, and from reciprocal recommenders in online matching.",
};

export const desirabilityRsrr: GameModule = { slug: "desirability-rsrr", hook: "Who should you ask, and who should you be shown to?", create: (env) => new DesirabilityRsrrGame(env), theory };
