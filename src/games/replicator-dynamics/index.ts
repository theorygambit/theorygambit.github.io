import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ReplicatorDynamicsGame } from "./ReplicatorDynamicsGame";

const theory: TheoryEntry = {
  idea: "Replicator dynamics say that a strategy's share grows when it earns more than the average and shrinks when it earns less. In a coordination game this has a tipping point: above it one strategy takes over, below it the other does, and the mix in between is unstable.",
  taught: [
    { beat: "Feel", text: "Choose a starting share of A and watch ten generations, from two different starts. They end in opposite places." },
    { beat: "See", text: "Drag the share along a line of A minus B. The arrows point away from the crossing, which is the tipping point." },
    { beat: "Prove", text: "New payoffs. Drag to the tipping share where A and B earn the same." },
  ],
  math: [
    { label: "Coordination game", expr: "A pays a only against A, B pays b only against B, mismatches pay 0" },
    { label: "Payoffs at share x of A", expr: "A earns a x, B earns b (1 - x)" },
    { label: "Tipping point", expr: "a x = b (1 - x), so x = b / (a + b)" },
    { label: "Replicator rule", expr: "the share of A rises when A earns more than B and falls when it earns less" },
  ],
  remember: "Above the tipping point A takes over. Below it, B does. The tipping point is where they earn the same.",
  practice: "Technology standards, languages and social norms tip once enough people use them. The tipping point is lower for the strategy that pays more when matched.",
  origin: "Taylor and Jonker introduced replicator dynamics in 1978. Coordination games show why history, and a starting share, can lock in one convention over another.",
};

export const replicatorDynamics: GameModule = {
  slug: "replicator-dynamics",
  hook: "Which side tips the crowd?",
  create: (env) => new ReplicatorDynamicsGame(env),
  theory,
};
