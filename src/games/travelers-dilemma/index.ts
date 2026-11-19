import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { TravelersDilemmaGame } from "./TravelersDilemmaGame";

const theory: TheoryEntry = {
  idea: "Two travellers name a claim. Both are paid the lower claim, the lower claimer gets a bonus and the higher one pays a penalty. Undercutting by one always pays, so logic pulls both claims all the way to the bottom, yet people stay high.",
  taught: [
    { beat: "Feel", text: "Three rounds of naming a claim. Each shows what claiming one lower would have paid." },
    { beat: "See", text: "Drag the partner's claim down. Your best reply is always one below, and the steps run to the floor." },
    { beat: "Prove", text: "A new bonus and range. Find the best reply, including when a small bonus makes matching best." },
  ],
  math: [
    { label: "Payoff for claim x against y", expr: "x + bonus if x < y, y - bonus if x > y, x if equal" },
    { label: "Best reply to y", expr: "y - 1 when the bonus is above 1, because y - 1 + bonus > y" },
    { label: "Small bonus", expr: "when the bonus is below 1, matching y beats undercutting" },
    { label: "Unravelling", expr: "10, 9, 8, ... down to the floor of 2, the only equilibrium" },
  ],
  remember: "Undercutting pays when the bonus beats one. Logic drags claims to the floor.",
  practice: "Price wars, arms races and bidding down show the same pull. Experiments find people stay high, especially when the bonus is small, which marks the limit of pure logic.",
  origin: "Kaushik Basu introduced the traveler's dilemma in 1994. It is a standard example of equilibrium logic that real behaviour does not follow.",
};

export const travelersDilemma: GameModule = {
  slug: "travelers-dilemma",
  hook: "Why would anyone claim less?",
  create: (env) => new TravelersDilemmaGame(env),
  theory,
};
