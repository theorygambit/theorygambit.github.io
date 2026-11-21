import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { CooperativeGamesGame } from "./CooperativeGamesGame";

const theory: TheoryEntry = {
  idea: "When players can bind themselves into groups, the question shifts from what to play to how to split what the group creates. A fair split can credit each player with what they add, averaged over every order in which the group could have formed.",
  taught: [
    { beat: "Feel", text: "Three players join one at a time. In each of six orders, every player takes what they add to the group so far." },
    { beat: "See", text: "Line up the six orders for each player and read off the average. That average is the fair share." },
    { beat: "Prove", text: "A new game. Drag to one player's average contribution." },
  ],
  math: [
    { label: "Characteristic function", expr: "v(S) is the value a group S can create alone" },
    { label: "Marginal contribution", expr: "v(S plus player) minus v(S), when the player joins S" },
    { label: "Shapley value", expr: "the average marginal contribution over all orders of arrival" },
    { label: "Efficiency", expr: "the shares add up to v of the whole group" },
  ],
  remember: "A fair share is your average contribution over every order of arrival.",
  practice: "Splitting joint costs, profits of a venture or credit in a model all use this idea. It rewards players who matter in many orders, not only the last to join.",
  origin: "Lloyd Shapley defined the value in 1953. It is the one split that is efficient, symmetric, ignores players who add nothing, and treats sums of games additively.",
};

export const cooperativeGames: GameModule = {
  slug: "cooperative-games",
  hook: "A group made something. How do you split it?",
  create: (env) => new CooperativeGamesGame(env),
  theory,
};
