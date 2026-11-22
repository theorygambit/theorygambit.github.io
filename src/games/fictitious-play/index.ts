import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { FictitiousPlayGame } from "./FictitiousPlayGame";

const theory: TheoryEntry = {
  idea: "Each player assumes the opponent will keep mixing as often as they have so far, and best responds to that history. In zero-sum games, and in several other classes, the long run frequencies of play converge to a Nash equilibrium.",
  taught: [
    { beat: "Feel", text: "A matcher plays the side your history favours. Play the opposite." },
    { beat: "See", text: "Tap to let both sides play on. Their long run mix settles at one half." },
    { beat: "Prove", text: "Given a history, say what the matcher plays next." },
  ],
  math: [
    { label: "Belief", expr: "opponent plays as often as before: freq_t" },
    { label: "Play", expr: "best response to freq_t" },
    { label: "Zero-sum games", expr: "freq_t -> equilibrium mix" },
  ],
  remember: "Learning from history works, but the path can circle for a long time before it settles.",
  practice: "Simple learning bots, modelling opponents who adapt to your habits, and why predictable play gets exploited.",
  origin: "George Brown, 1951, and Julia Robinson, 1951, who proved convergence for zero-sum games.",
};

export const fictitiousPlay: GameModule = { slug: "fictitious-play", hook: "What if everyone best responds to the past?", create: (env) => new FictitiousPlayGame(env), theory };
