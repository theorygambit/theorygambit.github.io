import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { BeautyContestGame } from "./BeautyContestGame";

const theory: TheoryEntry = {
  idea: "You win by guessing what the others will guess, not by choosing what you like. In a guess two thirds of the average game, every step of thinking ahead lowers the winning number, and the logical end is 0. Real crowds stop after a step or two, so the winner is one step ahead of them.",
  taught: [
    { beat: "Feel", text: "Three rounds of guessing two thirds of the average of twelve guesses. The crowd learns, so the target falls. A dashed ring shows the guess that would have won." },
    { beat: "See", text: "A ladder of reasoning. Tap to think one step further and the guess falls from 50 toward 0. Your own guesses sit on the ladder." },
    { beat: "Prove", text: "A new share and a crowd that has thought one or two steps. Land one step beyond them." },
  ],
  math: [
    { label: "Target", expr: "target = f * average, closest guess wins" },
    { label: "Someone who thinks k steps from a first guess of 50", expr: "guess_k = 50 * f^k" },
    { label: "With f = 2/3", expr: "50, 33, 22, 15, 10 ... then 0 at the limit" },
    { label: "One step beyond a crowd that thinks s steps", expr: "50 * f^(s + 1)" },
  ],
  remember: "Do not guess the best number. Guess what the others will guess, then go one step further.",
  practice: "Markets that move on what traders think others will buy, trends, launches and any contest scored against a crowd. Judge how far the crowd reasons, then stay a step ahead of it, not ten.",
  origin: "Named by John Maynard Keynes in 1936 for stock picking. The guess two thirds of the average game was studied by Rosemarie Nagel in 1995.",
};

export const beautyContest: GameModule = {
  slug: "beauty-contest",
  hook: "Guess what the crowd will guess.",
  create: (env) => new BeautyContestGame(env),
  theory,
};
