import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { HypergameTheoryGame } from "./HypergameTheoryGame";

const theory: TheoryEntry = {
  idea: "Each player may be playing a different game in their own mind. A move one side cannot see, or an outcome they do not expect, cannot be answered. So the real contest is often about whose picture of the game is right, and who can act outside the other's picture.",
  taught: [
    { beat: "Feel", text: "They play the game they can see. Use a move they know, which they counter, or one they cannot see." },
    { beat: "See", text: "Tap each of your moves to see what they do. They have no reply to the move outside their picture." },
    { beat: "Prove", text: "What a move pays when they can or cannot see it." },
  ],
  math: [
    { label: "Each player's game", expr: "G_i = the moves and payoffs player i believes in" },
    { label: "A seen move pays", expr: "worth - counter" },
    { label: "An unseen move pays", expr: "its full worth" },
  ],
  remember: "Surprise is a move the other side's picture does not contain.",
  practice: "Strategy games, negotiation, security and conflict, where each side models the other and can be wrong.",
  origin: "Peter Bennett, 1977, and Nigel Howard, with Michael Wang and others on hypergame analysis.",
};

export const hypergameTheory: GameModule = { slug: "hypergame-theory", hook: "What if every player sees a different game?", create: (env) => new HypergameTheoryGame(env), theory };
