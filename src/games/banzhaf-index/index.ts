import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { BanzhafIndexGame } from "./BanzhafIndexGame";

const theory: TheoryEntry = {
  idea: "A voter has power when their vote decides the result. Count the groups of other voters that lose without you and win with you. Those are your swings. Voting weight and voting power are different things: a seat can weigh a lot and decide nothing.",
  taught: [
    { beat: "Feel", text: "Pick a seat on a council. You earn one for each group of the others you tip over the quota." },
    { beat: "See", text: "Tap each group of the other seats to see whether your seat turns a loss into a win." },
    { beat: "Prove", text: "A new council. Count the swings for the filled seat." },
  ],
  math: [
    { label: "A swing for seat i", expr: "sum(S) < quota and sum(S) + w_i >= quota" },
    { label: "Banzhaf count", expr: "eta_i = number of swing groups S" },
    { label: "Power index", expr: "eta_i / sum of all eta_j" },
  ],
  remember: "Count the times you decide the outcome, not the votes you hold.",
  practice: "Shareholder votes, councils and committees, and who really controls a board when votes are unequal.",
  origin: "Lionel Penrose, 1946, John Banzhaf, 1965, and Lloyd Shapley with Martin Shubik, 1954.",
};

export const banzhafIndex: GameModule = { slug: "banzhaf-index", hook: "Does a big vote mean big power?", create: (env) => new BanzhafIndexGame(env), theory };
