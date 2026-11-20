import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { TragedyCommonsGame } from "./TragedyCommonsGame";

const theory: TheoryEntry = {
  idea: "A shared field is overgrazed because each herder keeps the whole gain of an extra sheep and pays only a share of the damage. Each does better by taking more, and all do worse when all take more.",
  taught: [
    { beat: "Feel", text: "Five herders share a field. Put out one sheep or two, and see what the other choice would have paid." },
    { beat: "See", text: "Five cases, by how many of the others put out two. Two wins in every case, yet everyone at two does worse than everyone at one." },
    { beat: "Prove", text: "Three new fields. Run both tests to decide whether each one is a tragedy." },
  ],
  math: [
    { label: "Value of one sheep", expr: "v = (A - N) / B, where N is all sheep on the field" },
    { label: "Your payoff", expr: "x × v, for x sheep of your own" },
    { label: "Tragedy needs both", expr: "two beats one whatever the others do, and all at two < all at one" },
    { label: "Here (A = 13, B = 2, 5 herders)", expr: "all at one: 4 each, you alone at two: 7, all at two: 3 each" },
  ],
  remember: "You keep the whole gain and pay a share of the cost.",
  practice: "Overfishing, traffic, carbon emissions, shared servers, open source maintenance and an office fridge. The fixes change the payoff: a quota, a price, a boundary, or a reputation that makes taking more cost you something.",
  origin: "Garrett Hardin, The Tragedy of the Commons (1968). Elinor Ostrom later showed that many communities avoid it with their own rules, and won the 2009 Nobel Prize for it.",
};

export const tragedyCommons: GameModule = {
  slug: "tragedy-commons",
  hook: "Why does everyone take a little more?",
  create: (env) => new TragedyCommonsGame(env),
  theory,
};
