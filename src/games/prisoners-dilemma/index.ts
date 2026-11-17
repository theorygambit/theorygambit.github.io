import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { PrisonersDilemmaGame } from "./PrisonersDilemmaGame";

const theory: TheoryEntry = {
  idea: "Two players each do better by betraying whatever the other does, yet both end up worse off than if they had trusted each other.",
  taught: [
    { beat: "Feel", text: "Three rounds against strangers. Each round also shows what the other move would have paid." },
    { beat: "See", text: "Tap their move and Break wins every time. The outcome both players would prefer sits out of reach." },
    { beat: "Prove", text: "Drag the temptation payoff down. Once it falls below the reward, Hold becomes a best reply and the dilemma is gone." },
  ],
  math: [
    { label: "Payoffs, from your side", expr: "T = break vs hold, R = both hold, P = both break, S = hold vs break" },
    { label: "It is a dilemma exactly when", expr: "T > R > P > S" },
    { label: "In this game", expr: "5 > 3 > 1 > 0, so Break is dominant and (Break, Break) pays 1 each, below (Hold, Hold) at 3 each" },
    { label: "Hold becomes stable against Hold when", expr: "R >= T" },
  ],
  remember: "Choosing well for yourself can leave everyone worse off.",
  practice: "Price wars, arms races, shared resources and open source contributions all have this shape. The usual exits are repetition, reputation, contracts and changing the payoffs so temptation shrinks.",
  origin: "Framed by Merrill Flood and Melvin Dresher in 1950 and named by Albert Tucker. A founding example of a dominant strategy outcome that is not Pareto efficient.",
};

export const prisonersDilemma: GameModule = {
  slug: "prisoners-dilemma",
  hook: "Why smart choices can make everyone worse off.",
  create: (env) => new PrisonersDilemmaGame(env),
  theory,
};
