import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { TaxonomyGame } from "./TaxonomyGame";

const theory: TheoryEntry = {
  idea: "Games can be sorted along a few questions: do players move at once or in turns, is the total fixed or not, how many players are there. Sorting tells you which tools apply.",
  taught: [
    { beat: "Feel", text: "Four situations. Tap the corner of the map where each belongs, and read why." },
    { beat: "See", text: "The finished map. Tap each corner to see what lives there." },
    { beat: "Prove", text: "Three new situations to place on the map." },
  ],
  math: [
    { label: "Timing", expr: "simultaneous (strategic form) or sequential (extensive form)" },
    { label: "Sum", expr: "zero or constant sum, or variable sum (positive or negative)" },
    { label: "Other axes in The Gambit", expr: "number of players, cooperative or not, perfect or imperfect information, finite or repeated" },
    { label: "Why classify", expr: "the class tells you the solution concept: minimax for zero-sum, equilibrium and bargaining otherwise" },
  ],
  remember: "Place the situation first, then pick the tool.",
  practice: "Before analysing a strategic problem, answer a few questions. Who moves when, and who sees what. Is anything fixed, or can value be created or lost. Wrong placement leads to the wrong tool, such as treating a negotiation as a duel.",
  origin: "Classification of games begins with Von Neumann and Morgenstern (1944). The Gambit extends it with further axes in its map of games.",
};

export const taxonomy: GameModule = {
  slug: "taxonomy",
  hook: "Two questions that place any game.",
  create: (env) => new TaxonomyGame(env),
  theory,
};
