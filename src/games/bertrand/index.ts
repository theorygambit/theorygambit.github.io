import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { BertrandGame } from "./BertrandGame";

const theory: TheoryEntry = {
  idea: "Firms sell the same good and compete on price. The cheapest takes every buyer, so each firm gains by cutting just under the other, and the cuts go on until price meets cost. Even two firms are enough.",
  taught: [
    { beat: "Feel", text: "Five rounds of pricing against a rival who goes one tick under you. Buyers move to the cheaper firm." },
    { beat: "See", text: "Your profit against your price for any rival price. Tap Undercut and watch the price fall to cost." },
    { beat: "Prove", text: "A new cost, then a firm with a cost edge. Find where the price settles, and how to price against a dearer rival." },
  ],
  math: [
    { label: "Profit at price p when the rival charges q, cost c, N buyers", expr: "profit = (p - c) * N if p < q, half of that if p = q, else 0" },
    { label: "Best reply to a rival price q above cost", expr: "p = q minus one tick" },
    { label: "Equilibrium with equal costs", expr: "p = c, profit 0 for both" },
    { label: "With costs c1 below c2", expr: "The cheaper firm prices just under c2 and takes the market" },
  ],
  remember: "Identical goods and a price war end at cost.",
  practice: "Commodity markets, fuel, flights and online shops that are easy to compare. Firms escape the trap by making goods less identical, by capacity limits, or by customer loyalty. Hidden or sticky prices soften the war.",
  origin: "Joseph Bertrand, 1883, in a review of Cournot's work. The result that price equals cost with two firms is called the Bertrand paradox.",
};

export const bertrand: GameModule = { slug: "bertrand", hook: "Undercut until price meets cost.", create: (env) => new BertrandGame(env), theory };
