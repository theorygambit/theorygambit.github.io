import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { MechanismDesignGame } from "./MechanismDesignGame";

const theory: TheoryEntry = {
  idea: "Mechanism design runs game theory backwards. You pick the rules of the game so that people acting in their own interest produce the result you want. The classic example is cut and choose: whoever cuts must make the pieces equal, because the other person picks first.",
  taught: [
    { beat: "Feel", text: "You cut a pie and the other player takes the bigger piece. Choose between two cuts, four times." },
    { beat: "See", text: "Switch who picks first, then drag the cut. The same cut is best under one rule and worst under the other." },
    { beat: "Prove", text: "New pies and rules. Pick the cut a selfish divider makes." },
  ],
  math: [
    { label: "They pick first", expr: "you keep min(a, N - a), best at a = N / 2" },
    { label: "You pick first", expr: "you keep max(a, N - a), best at a = 0" },
    { label: "Design goal", expr: "make the self-interested choice the one you want" },
  ],
  remember: "People respond to the rules, not to your hopes. Change what each choice pays and you change what they do.",
  practice: "Splitting a bill, dividing an inheritance, setting auction rules, pricing a ride share, assigning students to schools.",
  origin: "Leonid Hurwicz, Eric Maskin and Roger Myerson, who shared the 2007 Nobel prize for mechanism design.",
};

export const mechanismDesign: GameModule = { slug: "mechanism-design", hook: "Can the rules fix selfishness?", create: (env) => new MechanismDesignGame(env), theory };
