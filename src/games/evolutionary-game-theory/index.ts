import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { EvolutionaryGameTheoryGame } from "./EvolutionaryGameTheoryGame";

const theory: TheoryEntry = {
  idea: "No one chooses here. A strategy that earns more than average spreads, one that earns less fades. Run that rule long enough and the population settles where the strategies earn the same.",
  taught: [
    { beat: "Feel", text: "Pick a starting share of hawks, then watch ten generations. Two different starts end in the same place." },
    { beat: "See", text: "Drag the hawk share along a line. Above the axis hawks gain, below it they lose, and the line crosses at the stable share." },
    { beat: "Prove", text: "A new prize and a new fight cost. Drag to the share where hawks and doves earn the same." },
  ],
  math: [
    { label: "Prize V, fight cost C, with V < C", expr: "hawk vs hawk (V - C) / 2, hawk vs dove V, dove vs hawk 0, dove vs dove V / 2" },
    { label: "Average payoffs at hawk share x", expr: "hawk: x(V - C)/2 + (1 - x)V, dove: (1 - x)V/2" },
    { label: "Stable share", expr: "set them equal: x = V / C" },
    { label: "Replicator rule", expr: "a strategy grows when its payoff beats the population average" },
  ],
  remember: "Strategies spread when they beat the average. It settles where both earn the same.",
  practice: "Animal contests, spreading habits, platform norms and market conventions all follow this logic. A mixed population can be a stable answer, not a failure to decide.",
  origin: "Maynard Smith and Price introduced the evolutionarily stable strategy in 1973. Taylor and Jonker's replicator dynamics from 1978 describe how shares move.",
};

export const evolutionaryGameTheory: GameModule = {
  slug: "evolutionary-game-theory",
  hook: "Whatever pays more spreads.",
  create: (env) => new EvolutionaryGameTheoryGame(env),
  theory,
};
