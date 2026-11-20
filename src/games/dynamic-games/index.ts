import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { DynamicGamesGame } from "./DynamicGamesGame";

const theory: TheoryEntry = {
  idea: "In a dynamic game today's choice changes tomorrow's situation. A shared resource that grows back from what is left shows it: take too much now and there is less to take later.",
  taught: [
    { beat: "Feel", text: "Five periods on a shared pond. You choose a take, a rival takes a fixed amount, and what is left grows back." },
    { beat: "See", text: "Tomorrow's pond against today's take. It stays full up to a kink, then falls as you take more." },
    { beat: "Prove", text: "New ponds. Drag the steady harvest that keeps each one full. The old answer does not fit." },
  ],
  math: [
    { label: "The pond next period, from stock S, your take h and the rival's take r", expr: "S' = min(K, g (S - h - r))" },
    { label: "The pond stays full when a steady take is at most", expr: "h* = K - K/g - r" },
    { label: "A take above h* shrinks the pond every period", expr: "h > h*  =>  S' < K" },
  ],
  remember: "Today's choice is tomorrow's starting point.",
  practice: "Fisheries, forests, groundwater and savings accounts all work this way. A harvest that looks best today can leave less to harvest later, so plans must look ahead and work backward from the end.",
  origin: "Dynamic games study play over time, where the state of the world changes with each choice. Backward induction, solving from the last period back, is the standard tool.",
};

export const dynamicGames: GameModule = {
  slug: "dynamic-games",
  hook: "Today's choice shapes tomorrow's pond.",
  create: (env) => new DynamicGamesGame(env),
  theory,
};
