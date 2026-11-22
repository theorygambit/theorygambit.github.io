import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { PersonalizedPricingGame } from "./PersonalizedPricingGame";

const theory: TheoryEntry = {
  idea: "One price for everyone leaves money behind: it loses buyers who would pay less and undercharges those who would pay more. Charging each person or moment a price near their willingness to pay captures more, if you can predict it. It also raises questions of fairness, trust and what people do when they notice.",
  taught: [
    { beat: "Feel", text: "You see what each customer would pay. Set the price." },
    { beat: "See", text: "Drag one price for everyone. Profit rises, then falls as buyers drop out." },
    { beat: "Prove", text: "Sum the profit from a list of customers at a price." },
  ],
  math: [
    { label: "Profit from one customer", expr: "price - cost if price <= willingness to pay, else 0" },
    { label: "One price", expr: "profit(p) = (p - c) x share who buy" },
    { label: "Personalised ceiling", expr: "willingness to pay - cost for every buyer" },
  ],
  remember: "The best single price is a compromise. Personal prices remove it, with risks.",
  practice: "Ride pricing, airline fares, in-game offers, and discounts for students or loyal customers.",
  origin: "Price discrimination: Arthur Pigou, 1920. Dynamic pricing in airlines since the 1980s.",
};

export const personalizedPricing: GameModule = { slug: "personalized-pricing", hook: "What should each person pay?", create: (env) => new PersonalizedPricingGame(env), theory };
