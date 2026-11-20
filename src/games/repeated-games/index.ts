import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { RepeatedGamesGame } from "./RepeatedGamesGame";

const theory: TheoryEntry = {
  idea: "The same game played again and again. A break pays more today, but it can cost every round after. A promise of punishment makes holding stable, if the player cares enough about the future.",
  taught: [
    { beat: "Feel", text: "Eight rounds against someone who holds until you break once, then breaks forever. Each round shows what the other move would have paid." },
    { beat: "See", text: "Two streams of payoffs, each round worth a little less. Drag patience and watch holding overtake breaking." },
    { beat: "Prove", text: "New payoffs. Drag patience to where holding starts to win. The old answer does not fit." },
  ],
  math: [
    { label: "Patience d is the worth of the next round compared with this one", expr: "0 < d < 1" },
    { label: "Hold in every round, forever", expr: "R + dR + d^2 R + ... = R / (1 - d)" },
    { label: "Break now, then be punished forever", expr: "T + dP + d^2 P + ... = T + dP / (1 - d)" },
    { label: "Holding is stable when", expr: "d >= (T - R) / (T - P)" },
  ],
  remember: "Holding pays when the future is worth more than the grab.",
  practice: "Long business relationships, subscriptions and online reputations run on this. A partner who will not deal with you again has no reason to hold back, so threats of ending a relationship only work when both sides expect to meet again.",
  origin: "Studied through the Folk Theorem of repeated games. The grim trigger strategy was analysed by James Friedman in 1971.",
};

export const repeatedGames: GameModule = {
  slug: "repeated-games",
  hook: "Why the future makes people behave.",
  create: (env) => new RepeatedGamesGame(env),
  theory,
};
