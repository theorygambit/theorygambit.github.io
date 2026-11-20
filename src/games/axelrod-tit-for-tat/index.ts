import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { TitForTatGame } from "./TitForTatGame";

const theory: TheoryEntry = {
  idea: "Play the Prisoner's Dilemma again and again and cooperation can pay. A rule that starts nice, copies the last move and forgives beats cleverer rules, because it earns the rewards of cooperating and is never exploited for long.",
  taught: [
    { beat: "Feel", text: "Six rounds against a partner with a hidden rule. Hold or break, and watch the totals grow against steady holding." },
    { beat: "See", text: "Five rules meet in a round robin. Tit for tat never wins a match, yet scores highest overall." },
    { beat: "Prove", text: "You play tit for tat against new runs of moves. Fill in your replies, including the forgiving ones." },
  ],
  math: [
    { label: "Payoffs per round", expr: "hold and hold 3 each, break against hold 5 and 0, break and break 1 each" },
    { label: "Tit for tat", expr: "round 1: hold. Round n: play what they played in round n - 1" },
    { label: "Against always break (10 rounds)", expr: "0 + 9 × 1 = 9 for tit for tat, 5 + 9 × 1 = 14 for the breaker" },
    { label: "Against itself (10 rounds)", expr: "10 × 3 = 30" },
  ],
  remember: "Be nice, answer in kind, forgive.",
  practice: "Repeat dealings between suppliers, neighbours, coworkers and online sellers. Cooperation lasts when the future matters enough, when moves are visible, and when a single slip does not set off a permanent feud.",
  origin: "Robert Axelrod, The Evolution of Cooperation (1984). Anatol Rapoport entered tit for tat in two computer tournaments of strategies and it won both, against much longer and cleverer programs.",
};

export const axelrodTitForTat: GameModule = {
  slug: "axelrod-tit-for-tat",
  hook: "Which rule wins when the game repeats?",
  create: (env) => new TitForTatGame(env),
  theory,
};
