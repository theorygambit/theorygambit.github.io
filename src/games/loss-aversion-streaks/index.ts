import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { LossAversionStreaksGame } from "./LossAversionStreaksGame";

const theory: TheoryEntry = {
  idea: "A streak turns a habit into an asset you can lose. Each day it grows, and because a loss weighs more than an equal gain, the pain of breaking it grows faster than the effort of keeping it. Past some length, you keep going to avoid the loss.",
  taught: [
    { beat: "Feel", text: "Five days, each with an effort. Do it and the streak grows, skip and it resets to zero. See what a break would cost." },
    { beat: "See", text: "Drag the streak length. The cost of a break climbs steadily while the daily effort stays flat, and they cross." },
    { beat: "Prove", text: "New values. Drag to the first streak length where you keep going." },
  ],
  math: [
    { label: "Streak worth", expr: "g per day, so g x s after s days" },
    { label: "Cost of a break", expr: "lambda x g x s, with losses weighing lambda times gains" },
    { label: "Keep the streak when", expr: "lambda x g x s > effort e" },
    { label: "First streak worth keeping", expr: "floor(e / (lambda x g)) + 1" },
  ],
  remember: "The longer the streak, the more a break costs. Past a threshold, you keep it.",
  practice: "Language apps, fitness trackers and games use streaks on purpose. The same design can trap people into doing things only to avoid losing the count.",
  origin: "The loss aversion at work comes from Kahneman and Tversky's prospect theory. Streak counters apply it with a visible, growing reference point.",
};

export const lossAversionStreaks: GameModule = {
  slug: "loss-aversion-streaks",
  hook: "Why does a long streak feel impossible to break?",
  create: (env) => new LossAversionStreaksGame(env),
  theory,
};
