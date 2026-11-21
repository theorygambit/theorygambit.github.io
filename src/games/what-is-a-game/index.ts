import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { WhatIsAGameGame } from "./WhatIsAGameGame";

const theory: TheoryEntry = {
  idea: "A game is any situation where your best move depends on what other people do, and theirs on what you do.",
  taught: [
    { beat: "Feel", text: "Five drives. The first two roads are empty, the next three have another driver. Each round shows what the other lane would have paid." },
    { beat: "See", text: "Toggle the two situations. Alone, no lane is better. With a driver, their lane flips which lane is best for you." },
    { beat: "Prove", text: "Two tables where one row always wins. Raise one payoff until their move changes your best move." },
  ],
  math: [
    { label: "Best reply", expr: "BR(s_-i) = the s_i that maximises u_i(s_i, s_-i)" },
    { label: "A decision problem", expr: "BR(s_-i) is the same for every s_-i" },
    { label: "A game", expr: "BR(s_-i) changes when s_-i changes" },
    { label: "Lane game", expr: "Same lane: 0. Different lanes: 3. Your best lane is always the one they did not take." },
  ],
  remember: "If their move changes your best move, you are in a game.",
  practice: "Pricing against a rival, merging into traffic, bidding, negotiating and choosing a standard are all games. Planning a route on an empty road is not. Ask first whether anyone else's choice changes what is best for you.",
  origin: "The starting point of strategic thinking. Von Neumann and Morgenstern (1944) gave games their formal definition: players, strategies, information and payoffs.",
};

export const whatIsAGame: GameModule = {
  slug: "what-is-a-game",
  hook: "When your best move depends on theirs.",
  create: (env) => new WhatIsAGameGame(env),
  theory,
};
