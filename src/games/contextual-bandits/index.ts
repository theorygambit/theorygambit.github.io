import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ContextualBanditsGame } from "./ContextualBanditsGame";

const theory: TheoryEntry = {
  idea: "A bandit picks an option, sees the result, and must balance trying new options against using the best known one. A contextual bandit also looks at who is there: the best option for a commuter may not be the best for a night owl. Explore a little, and use what you know about the person.",
  taught: [
    { beat: "Feel", text: "Overall A is the favourite. A person arrives, and you pick what to show them." },
    { beat: "See", text: "Drag how often you explore. Never exploring gets stuck, always exploring wastes the best." },
    { beat: "Prove", text: "Given a person and the click rates, pick what to show." },
  ],
  math: [
    { label: "Policy", expr: "show argmax over options of predicted reward(option | context)" },
    { label: "Epsilon-greedy", expr: "explore with chance eps, otherwise exploit" },
    { label: "Regret", expr: "reward of the best option minus what you got" },
  ],
  remember: "Averages hide who is looking. Know the context, and keep learning.",
  practice: "Recommendations, offers, notifications, and any choice that is made for a person and learned from the result.",
  origin: "Herbert Robbins, 1952. Contextual bandits: Langford and Zhang, 2007, and Li and others, 2010.",
};

export const contextualBandits: GameModule = { slug: "contextual-bandits", hook: "Which option should you show this person?", create: (env) => new ContextualBanditsGame(env), theory };
