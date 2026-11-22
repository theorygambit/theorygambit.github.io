import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ReciprocityFairnessGame } from "./ReciprocityFairnessGame";

const theory: TheoryEntry = {
  idea: "People repay kindness and punish unkindness, and they judge by intention as well as by result. The same gift earns thanks when it was freely chosen and none when it was a bargain for the giver.",
  taught: [
    { beat: "Feel", text: "Four strangers give you coins. You see what they gave and what they could have given, then reward or punish." },
    { beat: "See", text: "Your replies on a plane of what they gave against what they could have given. They follow the side of the line." },
    { beat: "Prove", text: "Three new gifts, one big but unkind and one small but kind. Tap reward or punish." },
  ],
  math: [
    { label: "Kindness", expr: "k = what they gave - what they could have given" },
    { label: "A reciprocal reply", expr: "reward if k > 0, punish if k < 0, none if k = 0" },
    { label: "Outcome only would say", expr: "reward the biggest gift, whatever the choice" },
  ],
  remember: "People answer the choice, not the amount.",
  practice: "Tipping, gift exchange, bonuses, wage offers, apologies and favours. A sweetener that was never costly buys little. Social norms make cooperation cheap to enforce because people pay to reward and punish.",
  origin: "Matthew Rabin's model of fairness (1993) and the gift exchange experiments of Fehr and Gächter. In their games people repaid kind offers and punished unkind ones, even at a cost to themselves.",
};

export const reciprocityFairness: GameModule = {
  slug: "reciprocity-fairness",
  hook: "Why do we repay a favour nobody can force?",
  create: (env) => new ReciprocityFairnessGame(env),
  theory,
};
