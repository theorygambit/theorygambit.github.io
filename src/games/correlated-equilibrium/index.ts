import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { CorrelatedEquilibriumGame } from "./CorrelatedEquilibriumGame";

const theory: TheoryEntry = {
  idea: "A trusted signal tells each player what to do, without telling them what the others were told. If each player does best by obeying, given what the signal says about the others, nobody wants to disobey. That is a correlated equilibrium, and it can beat any equilibrium without a signal.",
  taught: [
    { beat: "Feel", text: "A traffic light tells you to go or wait in a game of Chicken. Obey or ignore it five times." },
    { beat: "See", text: "Tap each signal to see what obeying and ignoring pay. Told to wait, the other goes half the time, and waiting still pays more." },
    { beat: "Prove", text: "New payoffs. Find the smallest chance of each go signal that keeps waiting worthwhile." },
  ],
  math: [
    { label: "Light picks (go, wait) or (wait, go) with chance a each, otherwise (wait, wait)", expr: "told wait, the other goes with chance a / (1 - a)" },
    { label: "Obeying a wait holds when", expr: "a S + (1 - 2a) R >= (1 - 2a) T" },
    { label: "That is, a is at least", expr: "(T - R) / (S + 2 (T - R))" },
  ],
  remember: "A signal works when obeying it is each player's best reply, given what the signal tells them about the others.",
  practice: "Traffic lights, a referee who assigns who goes first, a mediator who suggests a split, and apps that route drivers to different roads. The signal is trusted only while following it pays.",
  origin: "Robert Aumann, 1974. It generalizes Nash equilibrium by letting players share a public or private randomizing device.",
};

export const correlatedEquilibrium: GameModule = { slug: "correlated-equilibrium", hook: "Can a traffic light be an equilibrium?", create: (env) => new CorrelatedEquilibriumGame(env), theory };
