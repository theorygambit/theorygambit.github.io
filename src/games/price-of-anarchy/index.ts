import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { PriceOfAnarchyGame } from "./PriceOfAnarchyGame";

const theory: TheoryEntry = {
  idea: "When everyone picks the route that is cheapest for them, traffic settles where no one can gain by switching, yet the average trip can cost more than a planner could achieve. The price of anarchy is the ratio of the two.",
  taught: [
    { beat: "Feel", text: "Five days of choosing between a fixed route and one that gets slower as it fills. Drivers copy whichever was cheaper." },
    { beat: "See", text: "Drag the share on the variable route and read the average cost. Selfish play sits at the right edge, the best split is lower." },
    { beat: "Prove", text: "A new network. Drag to the share that minimises the average cost." },
  ],
  math: [
    { label: "Pigou network", expr: "variable route costs a x, fixed route costs c, with x the share using the variable route" },
    { label: "Selfish equilibrium", expr: "x = c / a, or all of them if a < c" },
    { label: "Average cost", expr: "a x squared + c (1 - x)" },
    { label: "Best split", expr: "x = c / (2 a), found by setting the slope to zero" },
    { label: "Price of anarchy", expr: "cost of selfish play over cost of the best split, at most 4 over 3 here" },
  ],
  remember: "Selfish routing is stable but not best. The gap is the price of anarchy.",
  practice: "Road tolls, congestion pricing, network routing and shared servers all show it. Charging for the harm each user does to others moves selfish play toward the best split.",
  origin: "Pigou described the example in 1920. Koutsoupias and Papadimitriou named the price of anarchy in 1999, and Roughgarden proved that for linear costs it is at most 4 over 3.",
};

export const priceOfAnarchy: GameModule = {
  slug: "price-of-anarchy",
  hook: "How much does selfish driving cost everyone?",
  create: (env) => new PriceOfAnarchyGame(env),
  theory,
};
