import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { SimultaneousSequentialGame } from "./SimultaneousSequentialGame";

const theory: TheoryEntry = {
  idea: "Whether players move at the same time or one after another changes what each can know and threaten. The same payoffs can give different outcomes in a different order.",
  taught: [
    { beat: "Feel", text: "The same meeting game three ways: both choose at once, you move first, they move first." },
    { beat: "See", text: "Your payoff for each order. Moving first lets you commit. Moving second lets you react." },
    { beat: "Prove", text: "Three new tables. You move first, so work backward from their best reply to find where play ends." },
  ],
  math: [
    { label: "Simultaneous", expr: "each player picks without seeing the other, so a guess is needed" },
    { label: "Sequential, backward induction", expr: "find the second mover's best reply to each first move, then pick the first move that pays most after that reply" },
    { label: "In the meeting game", expr: "pay(A,A) = (3,2), pay(B,B) = (2,3), a miss pays (0,0). First mover gets their favourite." },
    { label: "Order and value", expr: "first mover advantage here, but not in every game" },
  ],
  remember: "Moving first lets you commit. Moving second lets you react.",
  practice: "Product launches, negotiations, standards and price changes all depend on who moves first and who can see. Committing early can win, and so can waiting to see. Ask who observes whom, and in what order.",
  origin: "Backward induction goes back to Zermelo (1913) and Kuhn (1953). Stackelberg (1934) modelled leader and follower firms.",
};

export const simultaneousSequential: GameModule = {
  slug: "simultaneous-sequential",
  hook: "Does it matter who moves first?",
  create: (env) => new SimultaneousSequentialGame(env),
  theory,
};
