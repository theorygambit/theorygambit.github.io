import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { SequentialEquilibriumGame } from "./SequentialEquilibriumGame";

const theory: TheoryEntry = {
  idea: "When you cannot see where you are in a game, you act on a belief about it. A sequential equilibrium pairs each strategy with beliefs, so that each move is the best reply to the belief at that point, and the beliefs match what the strategies make likely.",
  taught: [
    { beat: "Feel", text: "You cannot tell which of two spots you are in, but you hold a belief about it. Pick L or R at five different beliefs." },
    { beat: "See", text: "Drag along the belief line. L climbs, R falls, and the best move flips where they cross." },
    { beat: "Prove", text: "New payoffs. Drag the belief to where L and R pay the same." },
  ],
  math: [
    { label: "Expected pay of L with belief p in X", expr: "p xL + (1 - p) yL" },
    { label: "L and R tie at", expr: "p* = (yR - yL) / ((xL - xR) + (yR - yL))" },
    { label: "Best reply", expr: "L if p > p*, R if p < p*" },
  ],
  remember: "A move is only a best reply to a belief. Find the belief where two moves tie, and you know where the choice flips.",
  practice: "A doctor who treats before the test result, a firm that prices without knowing a rival's cost, a player who acts without seeing the last move.",
  origin: "David Kreps and Robert Wilson, 1982. It extends subgame perfection to games where players cannot see every earlier move.",
};

export const sequentialEquilibrium: GameModule = { slug: "sequential-equilibrium", hook: "What do you believe when you cannot see?", create: (env) => new SequentialEquilibriumGame(env), theory };
