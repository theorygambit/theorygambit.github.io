import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { FlowTheoryGame } from "./FlowTheoryGame";

const theory: TheoryEntry = {
  idea: "People lose themselves in a task when its challenge matches their skill. Too easy and they are bored, too hard and they are anxious. Flow is the narrow band between, and it moves up as skill grows.",
  taught: [
    { beat: "Feel", text: "Three short tracking runs, slow then faster then fast. Keep the disc inside the ring and notice how each one feels." },
    { beat: "See", text: "Your skill is where you started to slip. Your three runs sit above and below it on the challenge and skill plane." },
    { beat: "Prove", text: "Two new people with a given skill. Drag the challenge to where they would be in flow." },
  ],
  math: [
    { label: "Skill from your runs", expr: "the challenge where your hit rate crosses 65%" },
    { label: "State", expr: "bored if challenge < skill - 1.2, anxious if challenge > skill + 1.2, flow otherwise" },
    { label: "The band", expr: "skill - 1.2 ≤ challenge ≤ skill + 1.2" },
  ],
  remember: "Set the challenge just above the skill.",
  practice: "Level design, lessons, onboarding, training plans and work assignments. A game that adapts its difficulty to the player keeps them in the band. A fixed difficulty loses beginners to anxiety and experts to boredom.",
  origin: "Mihaly Csikszentmihalyi, Flow (1990). His channel model puts challenge and skill on two axes with flow along the diagonal between boredom and anxiety.",
};

export const flowTheory: GameModule = {
  slug: "flow-theory",
  hook: "When is a task exactly hard enough?",
  create: (env) => new FlowTheoryGame(env),
  theory,
};
