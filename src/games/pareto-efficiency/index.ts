import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ParetoGame } from "./ParetoGame";

const theory: TheoryEntry = {
  idea: "An outcome is Pareto efficient when no other outcome makes someone better off without making someone else worse off. It means no free improvements are left, not that the outcome is fair.",
  taught: [
    { beat: "Feel", text: "Drag an outcome toward better for you. The other side vetoes anything that hurts them, so the point slides until it sticks." },
    { beat: "See", text: "Every place it stuck lies on the outer edge of the feasible region. That edge is the Pareto frontier." },
    { beat: "Prove", text: "Tap every Pareto efficient outcome among six, and check against the ones that are dominated." },
  ],
  math: [
    { label: "a Pareto dominates b", expr: "a_i >= b_i for every player, and a_j > b_j for at least one" },
    { label: "Pareto efficient", expr: "no outcome dominates it" },
    { label: "Feasible region in this game", expr: "x >= 0, y >= 0, x^2 + y^2 <= 100. The frontier is the arc x^2 + y^2 = 100." },
    { label: "Efficient is not fair", expr: "(10, 0) is efficient. So is (0, 10)." },
  ],
  remember: "Efficient means no free improvement is left. It says nothing about fairness.",
  practice: "Any negotiation can leave value on the table. If both sides could gain, the deal is not efficient yet. Once you reach the frontier, gains for you cost the other side, and the question becomes distribution, not size.",
  origin: "Vilfredo Pareto, Manual of Political Economy (1906). The first welfare theorem links Pareto efficiency to competitive markets.",
};

export const paretoEfficiency: GameModule = {
  slug: "pareto-efficiency",
  hook: "When no one can gain for free.",
  create: (env) => new ParetoGame(env),
  theory,
};
