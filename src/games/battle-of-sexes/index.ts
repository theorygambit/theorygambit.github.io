import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { BattleOfSexesGame } from "./BattleOfSexesGame";

const theory: TheoryEntry = {
  idea: "Two people want to be together but prefer different places. Meeting pays both of them, missing pays nobody, and each would rather meet where they like best. The game is about agreeing, not about winning.",
  taught: [
    { beat: "Feel", text: "Five evenings with five partners. You love the opera, they love football, and a miss pays nothing." },
    { beat: "See", text: "Turn over the four outcomes. The two where you meet are the cells nobody leaves." },
    { beat: "Prove", text: "Two new tables with new numbers and a new order. Tap every cell where neither of you would move." },
  ],
  math: [
    { label: "Payoffs here", expr: "Meet at opera: you 3, they 2. Meet at football: you 2, they 3. Miss: 0 each." },
    { label: "With chance q that they go to the opera", expr: "EV(opera) = 3q, EV(football) = 2(1 - q)" },
    { label: "You are indifferent at", expr: "q* = 2 / (3 + 2) = 2/5" },
    { label: "Equilibria", expr: "(Opera, Opera) and (Football, Football), plus a mixed one that misses often" },
  ],
  remember: "Meeting beats winning. Something has to decide where.",
  practice: "Choosing a standard, a meeting place, a file format or who leads a project all work like this. A signal, a habit, a coin flip or taking turns settles it. Without one, both stick to their favourite and miss.",
  origin: "From Luce and Raiffa, Games and Decisions (1957). The original story has a couple choosing between a boxing match and a ballet. Compare Chicken, where the two stable cells are the ones where one player gives way.",
};

export const battleOfSexes: GameModule = {
  slug: "battle-of-sexes",
  hook: "You both want to meet. Where?",
  create: (env) => new BattleOfSexesGame(env),
  theory,
};
