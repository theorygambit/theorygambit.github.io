import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { LemkeHowsonGame } from "./LemkeHowsonGame";

const theory: TheoryEntry = {
  idea: "Checking that a profile is a Nash equilibrium is easy: see if anyone gains by switching. Finding one is hard. The Lemke-Howson algorithm follows a path of pivots that ends at an equilibrium, and it is usually short, but finding a Nash equilibrium is complete for a class called PPAD, so nobody expects a fast method for every game.",
  taught: [
    { beat: "Feel", text: "Find an equilibrium of a bigger and bigger game. Check every support, or follow one path." },
    { beat: "See", text: "Drag the number of actions. The count of supports to check explodes." },
    { beat: "Prove", text: "Count the pairs of supports brute force must check." },
  ],
  math: [
    { label: "Supports per player", expr: "2^n - 1 non-empty groups" },
    { label: "Pairs of supports", expr: "(2^n - 1)^2" },
    { label: "Verify a candidate", expr: "a few comparisons" },
  ],
  remember: "Easy to check, hard to find. Equilibrium may exist and still be out of reach.",
  practice: "Why solvers for large games use clever search, and why equilibrium may be a poor prediction when nobody can compute it.",
  origin: "Carlton Lemke and Joseph Howson, 1964. PPAD hardness: Daskalakis, Goldberg and Papadimitriou, 2006, and Chen and Deng, 2006.",
};

export const lemkeHowson: GameModule = { slug: "lemke-howson", hook: "Is finding an equilibrium really hard?", create: (env) => new LemkeHowsonGame(env), theory };
