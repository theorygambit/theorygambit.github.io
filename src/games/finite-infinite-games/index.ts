import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { FiniteInfiniteGamesGame } from "./FiniteInfiniteGamesGame";

const theory: TheoryEntry = {
  idea: "Finite games are played to win, and they end. Infinite games are played to keep playing, and winning is not the point. The same bold move wins one and breaks the other.",
  taught: [
    { beat: "Feel", text: "A race to 6 that someone wins, then a rally that has no finish and is worth its length." },
    { beat: "See", text: "Always safe and always bold, in each game. Safe never wins the race and always saves the rally." },
    { beat: "Prove", text: "Three new situations. Safe or bold, depending on which kind of game you are in." },
  ],
  math: [
    { label: "Race win chance", expr: "W(a, b) = max over moves of the average of W after the round" },
    { label: "Safe", expr: "a + 1. Bold: a + 2 with chance 1/2, otherwise a. The rival gains 1 and wins ties." },
    { label: "Rally length", expr: "bold: Σ (1 - 0.4)^t over 6 rounds ≈ 2.4. Safe: 6." },
  ],
  remember: "Ask which game you are in before you ask how to play.",
  practice: "A sales quarter is finite, a customer relationship is not. An election is finite, a democracy is not. A match is finite, a sport is not. Treating an infinite game as finite burns trust to win a round, and treating a finite game as infinite lets the clock run out.",
  origin: "James P. Carse, Finite and Infinite Games (1986). Finite players play within boundaries to win a title. Infinite players play with the boundaries, so that play goes on.",
};

export const finiteInfiniteGames: GameModule = {
  slug: "finite-infinite-games",
  hook: "Are you playing to win, or to keep playing?",
  create: (env) => new FiniteInfiniteGamesGame(env),
  theory,
};
