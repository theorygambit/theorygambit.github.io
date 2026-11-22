import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { SunkCostEndowmentGame } from "./SunkCostEndowmentGame";

const theory: TheoryEntry = {
  idea: "We value what we own or have already paid for more than a clean decision would say. What is already spent is gone either way, so only what is still ahead should count.",
  taught: [
    { beat: "Feel", text: "Three projects with more and more already spent. Finishing always costs 4 and pays 3. Go on or quit?" },
    { beat: "See", text: "The spent amount is the same in both columns, so it drops out. What is still ahead decides." },
    { beat: "Prove", text: "Three new projects. Go on or quit, leaving out what is spent." },
  ],
  math: [
    { label: "Go on", expr: "-sunk - cost + payoff" },
    { label: "Quit", expr: "-sunk" },
    { label: "Difference", expr: "payoff - cost, and sunk cancels" },
    { label: "Rule", expr: "go on if payoff > cost, whatever the sunk amount" },
  ],
  remember: "Spent is spent. Decide on what is still ahead.",
  practice: "Projects that run over, tickets for an event you no longer want, stocks held to get back to even, and anything you would not buy today at the price. The endowment effect is the cousin: owning an item raises what you ask for it above what you would pay. Ask what you would choose if you started fresh.",
  origin: "Arkes and Blumer (1985) on sunk costs, and Kahneman, Knetsch and Thaler (1990) on the endowment effect, where mug owners asked about twice as much as buyers would pay.",
};

export const sunkCostEndowment: GameModule = {
  slug: "sunk-cost-endowment",
  hook: "Why do we finish what we should abandon?",
  create: (env) => new SunkCostEndowmentGame(env),
  theory,
};
