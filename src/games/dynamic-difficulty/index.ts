import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { DynamicDifficultyGame } from "./DynamicDifficultyGame";

const theory: TheoryEntry = {
  idea: "The game watches how a player does and changes the challenge to match. Like a thermostat, each win nudges the level up and each loss nudges it down, until the player wins about as often as the designer aims for.",
  taught: [
    { beat: "Feel", text: "Pick a level six times and see how often you win. Too easy bores and too hard stings." },
    { beat: "See", text: "Play eight times and watch the level climb after a win and fall after a loss until it settles." },
    { beat: "Prove", text: "A new player and a new target. Set the level that gives that chance of winning." },
  ],
  math: [
    { label: "Chance of winning at level d for skill s", expr: "chance = 1 / (1 + e^(d - s))" },
    { label: "Level that gives a target chance T", expr: "d = s - ln(T / (1 - T))" },
    { label: "Thermostat step", expr: "win: + (1 - T), loss: - T" },
  ],
  remember: "The right level is not a fixed number. It is the one where this player wins at the target rate.",
  practice: "Racing games that ease off after crashes, shooters that adjust enemy aim, puzzle games that offer hints after many failures. The risk is that players feel the help and stop trusting their wins, so many games keep the adjustment small and hidden.",
  origin: "Dynamic difficulty adjustment grew out of flow research (Csikszentmihalyi) and early arcade games. It is a feedback loop of the kind used in control engineering.",
};

export const dynamicDifficulty: GameModule = { slug: "dynamic-difficulty", hook: "Can a game keep you at the edge of your skill?", create: (env) => new DynamicDifficultyGame(env), theory };
