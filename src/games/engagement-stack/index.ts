import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { EngagementStackGame } from "./EngagementStackGame";

const theory: TheoryEntry = {
  idea: "Modern products stack several layers of theory: ratings, difficulty tuning, value prediction and rules. The layers feed each other, so the power grows faster than the number of layers. The strain on the player grows too, and past a point it costs more than the layer adds.",
  taught: [
    { beat: "Feel", text: "Stack layers on a product five times and see the power, the strain and what is left." },
    { beat: "See", text: "Drag the layers. Power and strain climb together, and what is left peaks at two layers." },
    { beat: "Prove", text: "A new product. Choose the number of layers that leaves the most." },
  ],
  math: [
    { label: "Power of n layers, each worth e, each pair worth s", expr: "power = e n + s n (n - 1) / 2" },
    { label: "Strain on the player", expr: "strain = q n^2" },
    { label: "What is left", expr: "left = power - strain, best where one more layer adds less than it costs" },
  ],
  remember: "Layers combine, and so do their costs. Count both before adding another.",
  practice: "Games and apps that combine matchmaking, tuned difficulty, spend prediction and targeted offers. The same stack that makes a game feel fair can make it feel manipulative. Ask what each layer does for the player, not only for the metric.",
  origin: "A synthesis of the earlier ideas in this level: rating systems, adaptive difficulty, value prediction and rules engines, and the ethics of applying them.",
};

export const engagementStack: GameModule = { slug: "engagement-stack", hook: "What happens when every layer is switched on?", create: (env) => new EngagementStackGame(env), theory };
