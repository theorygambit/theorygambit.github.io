import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { BreakingFramesGame } from "./BreakingFramesGame";

const theory: TheoryEntry = {
  idea: "When you are losing inside a game, the strongest move is often to change the game: its order, its payoffs, its players, its information or its boundaries. A better move inside a bad game can be worth less than a different game.",
  taught: [
    { beat: "Feel", text: "You are stuck at 1 while the rival gets 5. Try three levers: move first, add a fine, or walk away." },
    { beat: "See", text: "The table you were stuck in, then the same table after the fine, where the equilibrium moves." },
    { beat: "Prove", text: "Three new standoffs. Tap the lever that helps most. A different one wins each time." },
  ],
  math: [
    { label: "Where you are", expr: "your payoff at the equilibrium of the table" },
    { label: "Move first", expr: "max over your rows of your payoff when they best reply" },
    { label: "Fine of 3 on their Press", expr: "their payoff in the Press column falls by 3, then solve again" },
    { label: "Walk away", expr: "a fixed exit payoff, taken if it beats the rest" },
  ],
  remember: "If you cannot win the game, change the game.",
  practice: "Renegotiating terms, changing who decides, adding a regulator, building an alternative so that you can leave, or changing what is measured. Players and information are levers too, and the ones to try next when the order, the payoffs and the exit do not help.",
  origin: "Brandenburger and Nalebuff, Co-opetition (1996), describe the five levers as players, added values, rules, tactics and scope. Schelling's work on strategic moves treats a change of order or a commitment as moves in their own right.",
};

export const breakingFrames: GameModule = {
  slug: "breaking-frames",
  hook: "What if the best move is to change the game?",
  create: (env) => new BreakingFramesGame(env),
  theory,
};
