import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { WarOfAttritionGame } from "./WarOfAttritionGame";

const theory: TheoryEntry = {
  idea: "Two players each pay a cost for every tick they wait, and the one who outlasts the other takes the prize. Waiting is worth it only if the chance the rival quits soon is high enough. In equilibrium each player quits at exactly the rate that leaves the other indifferent.",
  taught: [
    { beat: "Feel", text: "Hold or quit, tick by tick, against a rival who may quit at any moment. Each tick costs, and the prize goes to the one who stays." },
    { beat: "See", text: "Drag the rival's quit chance. The value of holding one more tick crosses zero at a single chance." },
    { beat: "Prove", text: "A new prize and cost. Drag to the quit chance that makes holding exactly break even." },
  ],
  math: [
    { label: "Prize V, cost c per tick", expr: "if the rival quits with chance p each tick" },
    { label: "Holding one more tick is worth", expr: "p V - c" },
    { label: "Indifference", expr: "p = c / V" },
    { label: "Average length", expr: "about 1 / p ticks, longer when the prize is large and waiting is cheap" },
  ],
  remember: "Hold on while the quit chance times the prize beats the cost of waiting.",
  practice: "Price wars, strikes, patent races and standoffs follow this pattern. Whoever values the prize more, or pays less to wait, outlasts the other.",
  origin: "Maynard Smith introduced the war of attrition in 1974 to explain animal contests. Its equilibrium has each side quitting at a constant rate, so lengths are random.",
};

export const warOfAttrition: GameModule = {
  slug: "war-of-attrition",
  hook: "How long should you hold out?",
  create: (env) => new WarOfAttritionGame(env),
  theory,
};
