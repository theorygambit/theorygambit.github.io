import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { LinearProgrammingZeroSumGame } from "./LinearProgrammingZeroSumGame";

const theory: TheoryEntry = {
  idea: "A two player zero-sum matrix game can be solved exactly by a linear program: choose your mix to maximise the payoff you are guaranteed whatever the other side does. The answer is the value of the game, and the program for the other side gives the same number.",
  taught: [
    { beat: "Feel", text: "Pick a mix between two rows. They answer with the worst column for you." },
    { beat: "See", text: "Drag the mix. Your guaranteed payoff is the lower of two lines, and it peaks where they cross." },
    { beat: "Prove", text: "New payoffs. Find the value of the game." },
  ],
  math: [
    { label: "Guaranteed payoff of mix p", expr: "min over columns of the row mix payoff" },
    { label: "Maximise it", expr: "max v subject to p A >= v for every column, p sums to 1" },
    { label: "Two by two, no saddle", expr: "value = (ad - bc) / (a + d - b - c)" },
  ],
  remember: "Make them indifferent. Your safe mix is the one where every column pays the same.",
  practice: "Solving poker endgames and security games exactly, and checking that any strategy you use cannot be beaten.",
  origin: "John von Neumann, 1928, and George Dantzig, 1947, who linked zero-sum games to linear programming.",
};

export const linearProgrammingZeroSum: GameModule = { slug: "linear-programming-zero-sum", hook: "Can you solve a zero-sum game exactly?", create: (env) => new LinearProgrammingZeroSumGame(env), theory };
