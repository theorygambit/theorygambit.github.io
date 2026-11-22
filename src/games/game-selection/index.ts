import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { GameSelectionGame } from "./GameSelectionGame";

const theory: TheoryEntry = {
  idea: "Often the most important strategic choice is not how to play, but which game to enter in the first place. A big prize with long odds can be worth less than a small prize you are likely to win.",
  taught: [
    { beat: "Feel", text: "Four times you pick one of three arenas, each with a prize and your chance to win it. Then you see what each was worth on average." },
    { beat: "See", text: "The prizes shrink to their averages, and the order changes." },
    { beat: "Prove", text: "Two new sets of arenas. Tap the one worth most per entry." },
  ],
  math: [
    { label: "Worth of an arena", expr: "EV = win chance × prize - entry cost" },
    { label: "Example", expr: "16 at 10% is 0.6. 8 at 30% is 1.4. 3 at 60% is 0.8." },
    { label: "Rule", expr: "enter the arena with the highest EV, not the highest prize or the best odds" },
  ],
  remember: "Pick the game before you pick the move.",
  practice: "Choosing a market, a niche, a career, a negotiation to join or a contest to enter. Where you can win matters more than how well you play where you cannot. Moving to a smaller pond is a strategy, not a retreat.",
  origin: "Treated in strategy writing as the choice of arena, from Porter's competitive strategy to Sun Tzu's advice to win before the battle. Brandenburger and Nalebuff list the scope of the game as one of five things a player can change.",
};

export const gameSelection: GameModule = {
  slug: "game-selection",
  hook: "Which game is worth entering?",
  create: (env) => new GameSelectionGame(env),
  theory,
};
