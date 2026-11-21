import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { RationalityGame } from "./RationalityGame";

const theory: TheoryEntry = {
  idea: "Classical theory assumes players pursue their goals consistently, and that everyone knows that everyone knows it. That chain of knowing is what lets reasoning run all the way to an answer.",
  taught: [
    { beat: "Feel", text: "Three crowds who thought for different lengths of time. Guess the number closest to two thirds of their average." },
    { beat: "See", text: "The ladder: each step of thinking multiplies the crowd's guess by two thirds, and it only stops at 0." },
    { beat: "Prove", text: "New contests and new crowds. Work out what the crowd will say, then aim one step beyond it." },
  ],
  math: [
    { label: "Crowd after k steps from a start guess g0", expr: "g_k = g0 * p^k" },
    { label: "Best reply to a crowd that will say q", expr: "aim = p * q = g0 * p^(k+1)" },
    { label: "With common knowledge of rationality", expr: "g_k -> 0 as k grows, so every player says 0 (the Nash equilibrium)" },
    { label: "This game", expr: "p = 2/3, start 50: 33, 22, 15, 10, 7, ... 0" },
  ],
  remember: "Aim one step beyond what the crowd will say. Only common knowledge takes you to zero.",
  practice: "Markets, bubbles and negotiations all depend on how many steps others will think. Equilibrium predictions assume the chain runs all the way. When people stop early, the best move is to be one step ahead, not infinitely ahead.",
  origin: "Keynes compared investing to a newspaper beauty contest. Rosemarie Nagel's guessing experiments (1995) showed typical players stop after one or two steps.",
};

export const rationalityCommonKnowledge: GameModule = {
  slug: "rationality-common-knowledge",
  hook: "How many steps ahead is the crowd thinking?",
  create: (env) => new RationalityGame(env),
  theory,
};
