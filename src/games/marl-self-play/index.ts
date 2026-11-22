import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MarlSelfPlayGame } from "./MarlSelfPlayGame";

const theory: TheoryEntry = {
  idea: "When many agents learn at once, each one's world keeps changing because the others change too. Training against copies of yourself keeps the opponent always at your level, so there is always something to learn. That is self-play, and it produced superhuman play in Go, chess and poker.",
  taught: [
    { beat: "Feel", text: "Train against a weaker or a stronger bot. Pick the one you learn most from." },
    { beat: "See", text: "Drag the opponent's level. Learning peaks against an equal." },
    { beat: "Prove", text: "New levels. Work out how much you learn." },
  ],
  math: [
    { label: "Learning signal", expr: "highest when the opponent's level is near yours" },
    { label: "Self-play", expr: "opponent = a copy of your latest self" },
    { label: "Risk", expr: "cycles, as in rock paper scissors, so keep a pool of past selves" },
  ],
  remember: "A teacher too easy or too hard teaches nothing. Your own copy is always a fair match.",
  practice: "Training game bots, matchmaking, and any system where agents adapt to each other.",
  origin: "Arthur Samuel's checkers, 1959. TD-Gammon: Gerald Tesauro, 1992. AlphaGo Zero: Silver and others, 2017.",
};

export const marlSelfPlay: GameModule = { slug: "marl-self-play", hook: "What happens when everyone is learning at once?", create: (env) => new MarlSelfPlayGame(env), theory };
