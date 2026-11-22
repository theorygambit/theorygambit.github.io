import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ScreeningPrincipalAgentGame } from "./ScreeningPrincipalAgentGame";

const theory: TheoryEntry = {
  idea: "A principal cannot watch effort, only results, so it pays a bonus for success. The agent will work only if the bonus raises its expected pay by at least the cost of the effort. The smallest bonus that gets the agent to work follows from that one inequality.",
  taught: [
    { beat: "Feel", text: "You are the agent. At three different bonuses, choose to work or shirk, and see what each is worth on average." },
    { beat: "See", text: "Drag the bonus. The value of working and the value of shirking cross at one bonus." },
    { beat: "Prove", text: "A new effort cost and new success chances. Drag to the smallest bonus that makes working worthwhile." },
  ],
  math: [
    { label: "Agent works", expr: "b pH - e, with success chance pH and effort cost e" },
    { label: "Agent shirks", expr: "b pL, with the lower success chance pL" },
    { label: "Incentive compatibility", expr: "work when b pH - e >= b pL, that is b >= e / (pH - pL)" },
    { label: "Weak lift, high bonus", expr: "when effort barely changes the odds, the bonus must be large" },
  ],
  remember: "The bonus must cover the effort cost, scaled by how much effort lifts the chance of success.",
  practice: "Sales commissions, stock options, piece rates and warranties are contracts built this way. Risk, limited liability and screening of hidden types complicate the simple rule.",
  origin: "The principal-agent problem was formalised in the 1970s by Ross, Mirrlees and Holmstrom. Holmstrom and Hart shared the 2016 Nobel prize for contract theory.",
};

export const screeningPrincipalAgent: GameModule = {
  slug: "screening-principal-agent",
  hook: "How big a bonus makes someone work?",
  create: (env) => new ScreeningPrincipalAgentGame(env),
  theory,
};
