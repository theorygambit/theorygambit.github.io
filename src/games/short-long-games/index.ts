import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ShortLongGame } from "./ShortLongGame";

const theory: TheoryEntry = {
  idea: "In a one off game, betraying can pay. In a repeated game, a betrayal is answered, so cooperating wins once the game lasts long enough. The length of the game changes the best move.",
  taught: [
    { beat: "Feel", text: "One round with a stranger, then four rounds with a partner who copies your last move." },
    { beat: "See", text: "Drag the number of rounds. Two discs show what holding and what betraying first would have earned in total." },
    { beat: "Prove", text: "New payoffs. Drag to the first round count where holding wins." },
  ],
  math: [
    { label: "Payoffs here", expr: "T = 5 (betray a holder), R = 3 (both hold), P = 1 (both betray)" },
    { label: "Hold for n rounds", expr: "n x R" },
    { label: "Betray first, then be answered", expr: "T + (n - 1) x P" },
    { label: "Holding wins when", expr: "n > (T - P) / (R - P) = 2, so from round 3" },
  ],
  remember: "The shadow of the future makes cooperation pay. Long games reward reputation.",
  practice: "Regular customers and suppliers, neighbours and teams cooperate because they will meet again. One off tourist deals and last round moves invite betrayal. Anything that lengthens the relationship supports trust.",
  origin: "The folk theorem of repeated games, and Axelrod's tournaments, show that cooperation can hold when the future matters enough. Compare the Prisoner's Dilemma, where one round makes betrayal dominant.",
};

export const shortLongGames: GameModule = {
  slug: "short-long-games",
  hook: "When does the future make cooperation pay?",
  create: (env) => new ShortLongGame(env),
  theory,
};
