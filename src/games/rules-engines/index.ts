import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { RulesEnginesGame } from "./RulesEnginesGame";

const theory: TheoryEntry = {
  idea: "A rules engine is an ordered list of conditions and actions. For each player it checks the rules from the top and the first one that matches decides the offer, the price or the limit. The order is part of the design.",
  taught: [
    { beat: "Feel", text: "Players arrive with traits. Guess which offer the list of rules gives each one." },
    { beat: "See", text: "Tap a rule to move it to the top and watch the same player get a different offer." },
    { beat: "Prove", text: "New lists and new players. Say which offer fires." },
  ],
  math: [
    { label: "For a player with traits T and rules r1, r2, r3 in order", expr: "fire the first ri whose condition is in T" },
    { label: "If no rule matches", expr: "the default applies" },
    { label: "Several rules can match", expr: "so the order decides, not the number of matches" },
  ],
  remember: "The first match wins, so the order of the rules is a decision you made.",
  practice: "Which price to show, which offer to send, which limit to apply, and which version of a feature a player sees. Good systems log which rule fired and test a change on a share of players before rolling it out, because a rule that looks harmless can shadow another one.",
  origin: "Production rule systems come from early artificial intelligence in the 1970s. Experimentation platforms add random assignment to compare two versions of a rule.",
};

export const rulesEngines: GameModule = { slug: "rules-engines", hook: "Which rule decides what you are offered?", create: (env) => new RulesEnginesGame(env), theory };
