import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { DesignEthicsGame } from "./DesignEthicsGame";

const theory: TheoryEntry = {
  idea: "A design can raise the number its maker measures while lowering what the player gets. Streaks, timers and variable rewards raise engagement, but past a point the player pays for it. Ethical design aims at the player's own gain, not at the metric.",
  taught: [
    { beat: "Feel", text: "Release three builds of a game, gentle to pushy. Disc is engagement, ring is what players gain." },
    { beat: "See", text: "Drag the pressure up. Engagement keeps climbing, while the players' gain peaks and falls." },
    { beat: "Prove", text: "Two new products. Drag to the pressure that is best for the player, not the one that engages most." },
  ],
  math: [
    { label: "Engagement at pressure x", expr: "E(x) = 1 - e^(-kx), always rising" },
    { label: "Player gain", expr: "B(x) = E(x) - c x², rises then falls" },
    { label: "The care point", expr: "the x that maximises B, where E'(x) = 2cx" },
  ],
  remember: "Optimise what the player gains, not only how long they stay.",
  practice: "Notification schedules, streaks, loot boxes, infinite scroll, subscription flows and dark patterns. A useful test: would the player choose this design if they could see how it works? Measure their outcomes, such as skills learned or time they say was well spent.",
  origin: "A modern concern in game and product design, discussed in work on persuasive technology and in the ethics guidelines of design bodies. It applies the idea of mechanism design in reverse: you are the one setting the rules, so you are responsible for the incentives you build.",
};

export const designEthics: GameModule = {
  slug: "design-ethics",
  hook: "When does a good loop become a trap?",
  create: (env) => new DesignEthicsGame(env),
  theory,
};
