import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { InequityAversionGame } from "./InequityAversionGame";

const theory: TheoryEntry = {
  idea: "People care about how their payoff compares with others. Being behind hurts more than being ahead, and both hurt. This explains why low offers are refused in the ultimatum game and why some people share when nobody could stop them.",
  taught: [
    { beat: "Feel", text: "Pick the split you would rather receive. The felt value depends on the gap." },
    { beat: "See", text: "Drag how guilty being ahead feels. The best share moves from everything to an even split." },
    { beat: "Prove", text: "New splits and rates. Compute the felt value." },
  ],
  math: [
    { label: "Fehr-Schmidt utility", expr: "U = x - alpha max(y - x, 0) - beta max(x - y, 0)" },
    { label: "Usually", expr: "alpha >= beta, envy beats guilt" },
    { label: "Even split is best for you when", expr: "beta > 1/2" },
  ],
  remember: "Money is not all you value. The gap itself costs you.",
  practice: "Pay transparency, fair pricing, and why players refuse deals that help them a little and help others a lot.",
  origin: "Ernst Fehr and Klaus Schmidt, 1999.",
};

export const inequityAversion: GameModule = { slug: "inequity-aversion", hook: "Why do people refuse free money?", create: (env) => new InequityAversionGame(env), theory };
