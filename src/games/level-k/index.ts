import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { LevelKGame } from "./LevelKGame";

const theory: TheoryEntry = {
  idea: "People reason only a few steps ahead. A level 0 player acts naively, and a level k player best responds to a crowd of level k minus 1. In the guess two thirds of the average game, real guesses cluster at the level 1 and level 2 answers, not at zero.",
  taught: [
    { beat: "Feel", text: "Guess two thirds of a crowd's average. Be closest to win." },
    { beat: "See", text: "Tap down the ladder. Each level guesses two thirds of the one below." },
    { beat: "Prove", text: "New starting averages. Find what a given level guesses." },
  ],
  math: [
    { label: "Level k guess", expr: "g_k = (2/3)^k x g_0" },
    { label: "Best response to a crowd averaging m", expr: "(2/3) m" },
    { label: "Fully rational crowd", expr: "g -> 0" },
  ],
  remember: "Being one step ahead of the crowd wins. Being ten steps ahead loses.",
  practice: "Beauty contests in markets, guessing what others guess, and designing games for players who stop thinking after a few steps.",
  origin: "Nagel, 1995, and Stahl and Wilson, 1995. Cognitive hierarchy: Camerer, Ho and Chong, 2004.",
};

export const levelK: GameModule = { slug: "level-k", hook: "How many steps ahead do people really think?", create: (env) => new LevelKGame(env), theory };
