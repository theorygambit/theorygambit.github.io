import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { BehavioralGameTheoryGame } from "./BehavioralGameTheoryGame";

const theory: TheoryEntry = {
  idea: "Real players reason a few steps, not infinitely many. In a guessing game where the winner is closest to a fraction of the average, perfect logic says zero, but crowds cluster at one or two steps of reasoning, and the best guess is a step or two ahead of the crowd.",
  taught: [
    { beat: "Feel", text: "Guess against a crowd. Find out how far above zero it really stayed, and what would have won." },
    { beat: "See", text: "Climb the ladder of levels. Level 0 guesses 50, and each next level takes the fraction of the last." },
    { beat: "Prove", text: "A new fraction. Drag to what a level 2 thinker would guess." },
  ],
  math: [
    { label: "Winning number", expr: "p x the average guess" },
    { label: "Level k guess", expr: "50 x p^k, with level 0 guessing 50" },
    { label: "Equilibrium", expr: "0, reached only if everyone reasons without limit" },
    { label: "Real crowds", expr: "mostly level 1 to 3, so the average stays well above zero" },
  ],
  remember: "People reason a few steps. Think one or two steps beyond the crowd, not infinitely many.",
  practice: "Markets, auctions and negotiations depend on what others expect. Modelling players as a few levels deep predicts surprises that equilibrium misses, from bubbles to price wars.",
  origin: "Nagel's 1995 beauty contest experiments showed averages near 35 for the two thirds game. Camerer, Ho and Chong built level k and cognitive hierarchy models from such data.",
};

export const behavioralGameTheory: GameModule = {
  slug: "behavioral-game-theory",
  hook: "How many steps ahead does the crowd really think?",
  create: (env) => new BehavioralGameTheoryGame(env),
  theory,
};
