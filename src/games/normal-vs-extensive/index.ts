import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { NormalVsExtensiveGame } from "./NormalVsExtensiveGame";

const theory: TheoryEntry = {
  idea: "A game can be written as a table, which lists every combination of choices as if made at once, or as a tree, which shows who moves when and what they know.",
  taught: [
    { beat: "Feel", text: "Three trees where you move first and they reply after watching you. The tree keeps the order." },
    { beat: "See", text: "Tap to fold the tree into a table. The same payoffs fly from the leaves into the cells, and the order disappears." },
    { beat: "Prove", text: "Three new games. A leaf is described in words, and you find its cell." },
  ],
  math: [
    { label: "Normal form", expr: "players, strategy sets S_i, payoffs u_i(s_1, s_2)" },
    { label: "Extensive form", expr: "a tree of decision nodes, edges for actions, payoffs at the leaves" },
    { label: "A leaf and its cell", expr: "leaf (first chose i, second chose j) = table cell (row i, column j)" },
    { label: "The second mover's strategy in a tree", expr: "a reply for every first move, so the table can have more columns than the tree has leaves per branch" },
  ],
  remember: "A table shows every pairing. A tree shows the order.",
  practice: "Use a table when choices are simultaneous and the payoffs are the story. Use a tree when order, information or threats matter, as in negotiations, entry decisions and turn based games.",
  origin: "Von Neumann and Morgenstern (1944) introduced both forms. Kuhn (1953) made the extensive form the standard tool for sequential games.",
};

export const normalVsExtensive: GameModule = {
  slug: "normal-vs-extensive",
  hook: "The same game as a table and as a tree.",
  create: (env) => new NormalVsExtensiveGame(env),
  theory,
};
