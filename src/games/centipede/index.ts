import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { CentipedeGame } from "./CentipedeGame";

const theory: TheoryEntry = {
  idea: "Two players take turns to take a small pile or pass and let it grow. Backward induction says the last mover takes, so the one before takes first, and the unravelling ends the game at the very first node, though passing to the end would pay both far more.",
  taught: [
    { beat: "Feel", text: "Play it against a partner who trusts you. Taking early or passing to the right moment changes what you earn." },
    { beat: "See", text: "Tap from the last node back to the first. Each mover takes, and the later nodes fade away." },
    { beat: "Prove", text: "New payoffs. Work back from the end and tap the node where logic stops the game." },
  ],
  math: [
    { label: "At each node", expr: "take if take > what passing leads to, given the solved rest" },
    { label: "Last node", expr: "take if take > the final payoff" },
    { label: "Earlier nodes", expr: "compare take with the solved next node, one step at a time" },
    { label: "Not always node 1", expr: "if passing pays more at some node, the unravelling stops there" },
  ],
  remember: "Solve from the end. Compare take with the solved rest, node by node.",
  practice: "Trust, credit and partnerships grow when both pass, yet a known last round invites an early grab. Real players pass far more than the logic predicts, which is why the result puzzles economists.",
  origin: "Rosenthal introduced the centipede game in 1981. Experiments by McKelvey and Palfrey found most players pass early, and the game ends well after the first node.",
};

export const centipede: GameModule = {
  slug: "centipede",
  hook: "Take now, or let it grow?",
  create: (env) => new CentipedeGame(env),
  theory,
};
