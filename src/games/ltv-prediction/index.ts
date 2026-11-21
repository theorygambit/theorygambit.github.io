import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { LtvPredictionGame } from "./LtvPredictionGame";

const theory: TheoryEntry = {
  idea: "A player is worth what they spend over their whole time in the game, not what they spend in week one. If a share stays each week, the expected stay is one over the share who leave, so small gains in staying are worth a lot.",
  taught: [
    { beat: "Feel", text: "Buy one of two groups of players, four times, with only week one to go on." },
    { beat: "See", text: "Drag how many stay each week. Lifetime value climbs slowly at first, then steeply past 80 percent." },
    { beat: "Prove", text: "A new spend and retention. Work out the lifetime value of a player." },
  ],
  math: [
    { label: "Weekly spend a, share who stay each week r", expr: "week t brings a r^t" },
    { label: "Expected weeks a player stays", expr: "1 / (1 - r)" },
    { label: "Lifetime value", expr: "LTV = a / (1 - r)" },
  ],
  remember: "Value is spend times how long they stay. Retention is the lever that compounds.",
  practice: "Deciding how much to pay to acquire a player, which cohorts to market to, and when a new feature has paid for itself. Real predictions use the early weeks to fit a curve, and the risk is treating a prediction as a fact about a person.",
  origin: "Customer lifetime value comes from marketing science and subscription businesses. Games adopted it with free to play, where most revenue comes from a few players who stay a long time.",
};

export const ltvPrediction: GameModule = { slug: "ltv-prediction", hook: "What is a player worth after week one?", create: (env) => new LtvPredictionGame(env), theory };
