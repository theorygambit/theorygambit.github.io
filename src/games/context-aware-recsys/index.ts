import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ContextAwareRecsysGame } from "./ContextAwareRecsysGame";

const theory: TheoryEntry = {
  idea: "A good suggestion depends on the moment as well as the history: time, place, activity and mood. Running a small model on the phone sees the moment instantly and keeps private signals on the device. A big model on a server knows more but sees a stale moment and arrives late.",
  taught: [
    { beat: "Feel", text: "Rank on the phone with the moment, or ask a bigger model on the server with a delay." },
    { beat: "See", text: "Drag the hour. The best item changes as the situation changes." },
    { beat: "Prove", text: "At a given hour, say which of two items fits better." },
  ],
  math: [
    { label: "Score", expr: "fit(item | history, context)" },
    { label: "On device", expr: "payoff = fit with the live context" },
    { label: "On server", expr: "payoff = fit with the old context - lag cost" },
  ],
  remember: "The best choice is for this moment. A late answer to the right question can lose to a quick answer to the right moment.",
  practice: "Music and video queues, notifications at the right time, and keeping sensitive signals on the phone.",
  origin: "Context-aware recommender systems: Adomavicius and Tuzhilin, 2005. On-device learning: federated learning, McMahan and others, 2017.",
};

export const contextAwareRecsys: GameModule = { slug: "context-aware-recsys", hook: "Why does the right suggestion depend on the moment?", create: (env) => new ContextAwareRecsysGame(env), theory };
