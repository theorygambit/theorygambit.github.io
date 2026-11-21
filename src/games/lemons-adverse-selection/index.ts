import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { LemonsGame } from "./LemonsGame";

const theory: TheoryEntry = {
  idea: "Buyers cannot tell good cars from bad, so they offer the average. That price is too low for the best cars, whose owners keep them. The average falls, more owners leave, and the market fills with lemons.",
  taught: [
    { beat: "Feel", text: "You own a car worth 6. Each round buyers offer a price, and you choose to sell or keep." },
    { beat: "See", text: "Tap through the rounds. Cars worth more than the offer leave, so the next offer is lower." },
    { beat: "Prove", text: "A new set of cars and a new buyer premium. Drag to the price where the market stops shrinking." },
  ],
  math: [
    { label: "Offer", expr: "m x the average quality of cars on sale, with m = 1.2 here" },
    { label: "An owner sells when", expr: "the offer is at least the car's worth" },
    { label: "Unravelling", expr: "remove cars worth more than the offer, recompute the average, repeat" },
    { label: "Stable market", expr: "every car on sale is worth no more than the offer" },
  ],
  remember: "Hidden quality means the average price drives the best sellers out.",
  practice: "Used cars, insurance, loans and hiring show the same pull. Warranties, inspections, reputations and licences fight it by making quality visible.",
  origin: "George Akerlof's 1970 paper on the market for lemons founded the economics of asymmetric information, and won a Nobel prize in 2001.",
};

export const lemonsAdverseSelection: GameModule = {
  slug: "lemons-adverse-selection",
  hook: "When buyers cannot see quality, bad drives out good.",
  create: (env) => new LemonsGame(env),
  theory,
};
