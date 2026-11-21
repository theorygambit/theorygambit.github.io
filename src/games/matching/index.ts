import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MatchingGame } from "./MatchingGame";

const theory: TheoryEntry = {
  idea: "Two sides each rank the other. A pairing is stable when no two people, not paired together, would both rather be with each other than with their partners. Stability, not a high total score, is what keeps a market from unravelling.",
  taught: [
    { beat: "Feel", text: "Pair three with three, and see whether any two would walk away together." },
    { beat: "See", text: "Replay deferred acceptance. One side asks in order of preference, the other keeps its best offer, and rejected asks move on." },
    { beat: "Prove", text: "New rankings. Build a pairing with no pair that would both prefer to leave." },
  ],
  math: [
    { label: "Blocking pair", expr: "a row r and column c, unmatched, with r liking c above its partner and c liking r above its partner" },
    { label: "Stable matching", expr: "one with no blocking pair" },
    { label: "Deferred acceptance", expr: "ask in order, hold the best offer, reject the rest, repeat until all are held" },
    { label: "Always exists", expr: "Gale and Shapley proved a stable matching exists for any strict rankings" },
  ],
  remember: "Look for a pair that would both rather leave. If none, the match is stable.",
  practice: "Medical residencies, school choice and kidney exchanges are run with deferred acceptance. The side that asks gets its best stable partners, so who asks matters.",
  origin: "Gale and Shapley published deferred acceptance in 1962. Roth applied it to real markets, and he and Shapley shared the 2012 Nobel prize.",
};

export const matching: GameModule = {
  slug: "matching",
  hook: "Pair them so that nobody wants to leave.",
  create: (env) => new MatchingGame(env),
  theory,
};
