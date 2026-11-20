import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ChickenGame } from "./ChickenGame";

const theory: TheoryEntry = {
  idea: "Two drivers head for each other. Whoever swerves loses face, and if neither does both lose everything. Each wants to be the one who dares while the other yields, so there are two stable outcomes and a deadly one between them.",
  taught: [
    { beat: "Feel", text: "Five drivers with records of how often they dared. Swerve or dare, and see what the other choice would have paid." },
    { beat: "See", text: "Tap each choice to mark the best reply. Dare against a swerver, swerve against a darer. Two cells are marked by both players." },
    { beat: "Prove", text: "You throw away the wheel and will dare. New payoffs decide whether a rational rival still swerves." },
  ],
  math: [
    { label: "Payoffs here", expr: "T = 4 (dare, they swerve), R = 3, S = 1 (swerve, they dare), P = 0 (crash)" },
    { label: "With chance q that they dare", expr: "EV(dare) = 4(1 - q), EV(swerve) = 3(1 - q) + q" },
    { label: "You are indifferent at", expr: "q* = (T - R) / ((T - R) + (S - P)) = 1/2" },
    { label: "Equilibria", expr: "(Dare, Swerve) and (Swerve, Dare), plus a mixed one" },
  ],
  remember: "Commit first and the other swerves, as long as a crash is worse than giving in.",
  practice: "Price wars, strikes, brinkmanship, standoffs in negotiation and merging traffic all work like this. Commitment devices such as a public deadline or a delegated negotiator make a threat believable. The same game in biology is Hawk and Dove.",
  origin: "Bertrand Russell compared the nuclear stand off to the game of chicken. Maynard Smith and Price used the same table for Hawk and Dove in evolutionary biology. Compare Battle of the Sexes, which also has two stable cells.",
};

export const chicken: GameModule = {
  slug: "chicken",
  hook: "Who blinks first when a crash costs everything?",
  create: (env) => new ChickenGame(env),
  theory,
};
