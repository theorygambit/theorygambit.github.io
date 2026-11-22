import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { HypergameLevelsGame } from "./HypergameLevelsGame";

const theory: TheoryEntry = {
  idea: "Hypergames climb a ladder. Level 0 is a shared game. At level 1 a player is wrong about the game and does not know it, so they can be exploited. At level 2 they know others may see differently and hedge. Higher levels model the hedging itself, and the gap to exploit shrinks at each step.",
  taught: [
    { beat: "Feel", text: "Exploit what they believe, or play safe. What they believe depends on their level." },
    { beat: "See", text: "Tap up the ladder. Each level knows a little more about the other's picture." },
    { beat: "Prove", text: "Name the level from a description." },
  ],
  math: [
    { label: "Level 0", expr: "G_1 = G_2 = G, shared" },
    { label: "Level 1", expr: "G_1 differs from G_2, and neither knows" },
    { label: "Level 2 and up", expr: "a player models the other's picture, and then the other's model of theirs" },
  ],
  remember: "You can exploit a wrong picture only while the other side does not know it is wrong.",
  practice: "Deception, security, diplomacy and negotiation, where each side models what the other believes.",
  origin: "Peter Bennett, 1977, and Nigel Howard. Levels of hypergames: Bennett and Huxham, 1982.",
};

export const hypergameLevels: GameModule = { slug: "hypergame-levels", hook: "How far up does 'I know that you know' go?", create: (env) => new HypergameLevelsGame(env), theory };
