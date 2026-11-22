import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { PotentialGamesGame } from "./PotentialGamesGame";

const theory: TheoryEntry = {
  idea: "In a potential game, one shared score tracks everyone's incentives: any move that helps the player who makes it also raises the score. Selfish improvement can therefore only climb, so it always ends at a peak, and every local peak is an equilibrium.",
  taught: [
    { beat: "Feel", text: "Start anywhere on a grid of shared scores and let players improve one at a time. See where the climb stops." },
    { beat: "See", text: "Mark every cell's improving moves in two taps. Cells with no arrows are the stable ones." },
    { beat: "Prove", text: "Two new grids. Tap every cell where neither player can improve." },
  ],
  math: [
    { label: "Potential", expr: "a function Phi where each player's gain from deviating equals the change in Phi" },
    { label: "Improvement path", expr: "each selfish move raises Phi, so no path can cycle" },
    { label: "Pure equilibria", expr: "cells that are best in their row and in their column, local peaks of Phi" },
    { label: "Existence", expr: "every finite potential game has a pure equilibrium" },
  ],
  remember: "Selfish moves climb the shared score, so they end at a peak, though maybe not the highest.",
  practice: "Congestion games, network formation and coordination problems are potential games. It also tells designers that decentralised improvement will converge, and which peak you land on depends on where you start.",
  origin: "Monderer and Shapley defined potential games in 1996, building on Rosenthal's 1973 proof that congestion games always have pure equilibria.",
};

export const potentialGames: GameModule = {
  slug: "potential-games",
  hook: "Selfish moves that always climb.",
  create: (env) => new PotentialGamesGame(env),
  theory,
};
