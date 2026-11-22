import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MetagameHowardGame } from "./MetagameHowardGame";

const theory: TheoryEntry = {
  idea: "A metagame is a game about the game. Instead of choosing a move against a fixed move, each player responds to the policy the other will use in reply. A prisoner's dilemma against someone who copies your move has cooperation as its best reply, though defection is best against any fixed move.",
  taught: [
    { beat: "Feel", text: "They reply to your move by a policy. Cooperate or defect against each policy." },
    { beat: "See", text: "Tap each policy to see what each of your moves earns. Defect is not always best." },
    { beat: "Prove", text: "Given a policy, find your best move." },
  ],
  math: [
    { label: "A policy", expr: "a rule: your move -> their move" },
    { label: "Your payoff against it", expr: "u(you, policy(you))" },
    { label: "Metagame equilibrium", expr: "no one gains by changing, given the other's policy" },
  ],
  remember: "Against a rule, think about what your move makes them do.",
  practice: "Threats, promises and reputations, tit for tat, and any strategy that conditions on what others do.",
  origin: "Nigel Howard, 1971, Paradoxes of Rationality: Theory of Metagames and Political Behavior.",
};

export const metagameHoward: GameModule = { slug: "metagame-howard", hook: "What if you answer their policy, not their move?", create: (env) => new MetagameHowardGame(env), theory };
