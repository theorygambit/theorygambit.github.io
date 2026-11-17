import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { StagHuntGame } from "./StagHuntGame";

const theory: TheoryEntry = {
  idea: "Two players can reach a better outcome only if both commit to it. Each will commit only when they trust the other enough, so there are two stable outcomes: a risky good one and a safe poor one.",
  taught: [
    { beat: "Feel", text: "Five partners with different track records. Stag pays more but only if they join." },
    { beat: "See", text: "Hare is a flat line and Stag rises with your belief. They cross at one point, and you can see which choices fell on the wrong side." },
    { beat: "Prove", text: "Payoffs change. Drag to the belief where you would switch, then lock it in." },
  ],
  math: [
    { label: "Payoffs here", expr: "Stag with Stag = 3, Hare = 2 always, Stag against Hare = 0" },
    { label: "With belief p that they hunt stag", expr: "EV(Stag) = 3p, EV(Hare) = 2" },
    { label: "You are indifferent at", expr: "p* = hare / stag = 2/3" },
    { label: "Equilibria", expr: "(Stag, Stag) is payoff dominant, (Hare, Hare) is risk dominant" },
  ],
  remember: "Cooperation needs enough trust. The threshold is hare over stag.",
  practice: "Standards, bank runs, technology adoption, climate agreements and team projects all work like this. Moves that raise trust, such as visible commitments and shared signals, lower the risk of aiming high.",
  origin: "From Rousseau's stag hunt, formalised in game theory as the canonical coordination problem. Compare the Prisoner's Dilemma, where Break dominates.",
};

export const stagHunt: GameModule = {
  slug: "stag-hunt",
  hook: "How much trust does a shared goal need?",
  create: (env) => new StagHuntGame(env),
  theory,
};
