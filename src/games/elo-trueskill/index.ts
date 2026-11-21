import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { EloTrueSkillGame } from "./EloTrueSkillGame";

const theory: TheoryEntry = {
  idea: "A rating is a prediction of how often you win. After each match it moves by how surprising the result was, so beating a stronger player moves it a lot and beating a weaker one barely moves it.",
  taught: [
    { beat: "Feel", text: "Choose who to play five times and see how each win or loss moves your rating." },
    { beat: "See", text: "Drag the gap between two ratings and read the chance of winning. Go to a gap of 300 or more each way." },
    { beat: "Prove", text: "A new rating, rival and K. Work out your rating after the result." },
  ],
  math: [
    { label: "Chance that you beat a rival", expr: "E = 1 / (1 + 10^((rival - you) / 400))" },
    { label: "New rating after a result S (1 win, 0 loss)", expr: "new = old + K (S - E)" },
    { label: "Winner and loser move equal and opposite amounts", expr: "total rating stays the same" },
  ],
  remember: "A rating moves by K times the surprise. Fair matches are the ones near an even chance.",
  practice: "Chess, matchmaking in online games, sports leagues and any ranking built from head to head results. Glicko adds how sure the rating is, and TrueSkill extends the idea to teams and several players.",
  origin: "Arpad Elo, for chess ratings in the 1960s. Glicko (Glickman, 1995) and TrueSkill (Microsoft, 2006) add uncertainty about each rating.",
};

export const eloTrueSkill: GameModule = { slug: "elo-trueskill", hook: "How does a win change what you are worth?", create: (env) => new EloTrueSkillGame(env), theory };
