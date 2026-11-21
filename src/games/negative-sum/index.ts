import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { NegativeSumGame } from "./NegativeSumGame";

const theory: TheoryEntry = {
  idea: "In a negative-sum game, conflict destroys value, so the total shrinks. Everyone can end up worse off than if they had left each other alone.",
  taught: [
    { beat: "Feel", text: "Four rounds of fight or walk. Each side's disc is compared with its dashed ring, the 5 it would keep by walking away." },
    { beat: "See", text: "The four outcomes against the line where nothing is lost. Every outcome with a fight falls below it." },
    { beat: "Prove", text: "Tap every outcome that leaves both sides worse off than where they started." },
  ],
  math: [
    { label: "Payoffs (you, they)", expr: "walk,walk = (5,5)   fight,walk = (7,2)   walk,fight = (2,7)   fight,fight = (3,3)" },
    { label: "Value destroyed", expr: "10 - (u_1 + u_2)" },
    { label: "Negative-sum", expr: "u_1 + u_2 < the total available without conflict" },
    { label: "Worse for both than a status quo s", expr: "x < s_1 and y < s_2" },
  ],
  remember: "When conflict burns the pie, everyone can lose.",
  practice: "Wars, price wars, lawsuits and arms races destroy value on both sides. Even when fighting pays a single player against a passive one, the group as a whole ends up poorer. Costly conflict is the signal to look for a way to walk away together.",
  origin: "Named by contrast with zero-sum games. Discussed by Schelling (1960) in The Strategy of Conflict, where he shows that conflict and cooperation are intertwined.",
};

export const negativeSum: GameModule = {
  slug: "negative-sum",
  hook: "When fighting shrinks the pie.",
  create: (env) => new NegativeSumGame(env),
  theory,
};
