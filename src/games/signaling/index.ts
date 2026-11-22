import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { SignalingGame } from "./SignalingGame";

const theory: TheoryEntry = {
  idea: "A costly action can reveal hidden quality when it is cheaper for the strong type than for the weak one. If the bar is high enough that the weak type would lose by clearing it, but low enough that the strong type gains, only the strong type signals, and the signal is believed.",
  taught: [
    { beat: "Feel", text: "You are a worker of a known type. Study to clear the employer's bar, or skip. Strong types pay less for each year." },
    { beat: "See", text: "Drag the bar. See which types gain from clearing it, and find the range where only the strong type does." },
    { beat: "Prove", text: "New costs and a new premium. Drag to a bar that separates the types." },
  ],
  math: [
    { label: "Net gain of clearing a bar of s years", expr: "W - c s, with a lower c for the strong type" },
    { label: "Strong type signals when", expr: "s <= W / cStrong" },
    { label: "Weak type does not when", expr: "s > W / cWeak" },
    { label: "Separating bars", expr: "W / cWeak < s <= W / cStrong, a range that exists only if the weak type pays more per year" },
  ],
  remember: "A signal works when it costs the weak type more than it pays, but not the strong type.",
  practice: "Degrees, warranties, advertising and brand investments work as signals. The content hardly matters. What matters is that faking it costs the wrong type too much.",
  origin: "Michael Spence's 1973 model of job market signaling founded the field. He shared the 2001 Nobel prize with Akerlof and Stiglitz.",
};

export const signaling: GameModule = {
  slug: "signaling",
  hook: "What proves quality that no one can see?",
  create: (env) => new SignalingGame(env),
  theory,
};
