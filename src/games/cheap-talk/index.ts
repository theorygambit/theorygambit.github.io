import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { CheapTalkGame } from "./CheapTalkGame";

const theory: TheoryEntry = {
  idea: "A message that costs nothing can still carry information, but only if the sender and the listener want similar things. When their interests drift too far apart, every message is ignored, because the sender would say the same thing whatever the truth.",
  taught: [
    { beat: "Feel", text: "A sender says low or high about a hidden state. Believe it or ignore it, with a different bias each time." },
    { beat: "See", text: "Drag the bias. What you can learn falls as the bias grows and is gone at a quarter." },
    { beat: "Prove", text: "New biases. Drag the state where the sender switches from low to high." },
  ],
  math: [
    { label: "Sender indifferent at the cutoff c when", expr: "c + b is halfway between the two actions" },
    { label: "Cutoff for a bias b", expr: "c = 1/2 - 2b" },
    { label: "No cutoff when", expr: "b >= 1/4, and talk is babbling" },
  ],
  remember: "Free words are believed only when the speaker gains little by lying. Too much bias and the listener tunes out.",
  practice: "Analyst reports, a salesperson's advice, a friend recommending a restaurant, a colleague who wants your vote.",
  origin: "Vincent Crawford and Joel Sobel, 1982.",
};

export const cheapTalk: GameModule = { slug: "cheap-talk", hook: "Can words that cost nothing mean anything?", create: (env) => new CheapTalkGame(env), theory };
