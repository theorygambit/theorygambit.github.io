import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { StackelbergGame } from "./StackelbergGame";

const theory: TheoryEntry = {
  idea: "One firm commits to a quantity first and the other sees it before it chooses. Because the follower will react, the leader commits to more than it would in a simultaneous market, and earns more.",
  taught: [
    { beat: "Feel", text: "Commit to a quantity first and watch the rival reply, then compare with selling at the same time." },
    { beat: "See", text: "Drag along your quantity. Your profit peaks at 45 because the rival reacts, not at 30." },
    { beat: "Prove", text: "New markets. Choose the leader's best quantity, or reply as the follower." },
  ],
  math: [
    { label: "The follower replies to the committed q", expr: "q' = (a - c - q) / 2" },
    { label: "Knowing this, the leader earns q (a - c - q) / 2, which peaks at", expr: "q = (a - c) / 2" },
    { label: "Profits: leader, follower, and each when both move at once", expr: "(a - c)^2 / 8, / 16, / 9" },
  ],
  remember: "Moving first is worth something only when the commitment is visible and cannot be undone.",
  practice: "A dominant firm that builds capacity before rivals do, a union that announces a demand first, a country that sets policy before another responds. Commitment works only if the other side believes it.",
  origin: "Heinrich von Stackelberg, 1934. The first model where the order of moves changes the outcome.",
};

export const stackelberg: GameModule = { slug: "stackelberg", hook: "What does moving first buy you?", create: (env) => new StackelbergGame(env), theory };
