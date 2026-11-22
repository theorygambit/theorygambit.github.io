import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { VcgGame } from "./VcgGame";

const theory: TheoryEntry = {
  idea: "Charge each person the harm their participation does to everyone else, and telling the truth becomes the best policy. The winner of an auction pays the value of the best loser, which is exactly what their win takes from the others.",
  taught: [
    { beat: "Feel", text: "You bid for an item. Report your true value or something else, four times." },
    { beat: "See", text: "Drag your report. Above the best rival you win and pay their value, so no report beats the truth." },
    { beat: "Prove", text: "New bidders. Work out what you pay when you win and when you lose." },
  ],
  math: [
    { label: "Winner pays the harm to others", expr: "price = best value among the others" },
    { label: "Your gain when you win", expr: "your value - price" },
    { label: "No report improves on the truth", expr: "the price does not depend on your report" },
  ],
  remember: "If the price does not depend on what you say, you gain nothing by lying. Lie only to lose a good deal or win a bad one.",
  practice: "Second price auctions, ad slot auctions, spectrum sales, and rules that split the cost of a public project by the harm each person causes.",
  origin: "William Vickrey, 1961, Edward Clarke, 1971, and Theodore Groves, 1973.",
};

export const vcg: GameModule = { slug: "vcg", hook: "What price makes honesty the best policy?", create: (env) => new VcgGame(env), theory };
