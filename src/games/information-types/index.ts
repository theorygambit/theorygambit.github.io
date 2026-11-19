import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { InformationTypesGame } from "./InformationTypesGame";

const theory: TheoryEntry = {
  idea: "Two different questions describe what players know. Perfect information asks whether you see the past moves. Complete information asks whether you know the rules and everyone's payoffs. Each can be yes or no on its own.",
  taught: [
    { beat: "Feel", text: "Four rounds of guessing a move. In each, either the move, the payoffs, both or neither are hidden." },
    { beat: "See", text: "Your four rounds land on a grid of the two questions, and you see which hiding really cost you." },
    { beat: "Prove", text: "Three new games. Tap the corner of the grid each one belongs to." },
  ],
  math: [
    { label: "Perfect information", expr: "every move so far is seen by the player to act" },
    { label: "Complete information", expr: "the game, including every payoff, is common knowledge" },
    { label: "Four corners", expr: "(perfect, complete), (imperfect, complete), (perfect, incomplete), (imperfect, incomplete)" },
  ],
  remember: "Seeing moves and knowing payoffs are separate questions. Ask both.",
  practice: "Chess is perfect and complete. Rock paper scissors hides moves. A sealed bid auction hides moves and private values. Negotiating with an unknown rival in turns shows every move but hides the payoffs.",
  origin: "Perfect versus imperfect goes back to von Neumann and Morgenstern. Harsanyi turned incomplete information into imperfect information about a hidden type, which is how Bayesian games work.",
};

export const informationTypes: GameModule = {
  slug: "information-types",
  hook: "What can you see, and what do you know?",
  create: (env) => new InformationTypesGame(env),
  theory,
};
