import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { BayesianPersuasionGame } from "./BayesianPersuasionGame";

const theory: TheoryEntry = {
  idea: "A sender who can commit to what information to reveal can change what a rational receiver does, without lying. By pooling bad news with good, the sender pushes the receiver's belief right up to the point where they still say yes.",
  taught: [
    { beat: "Feel", text: "You want a conviction. Reveal the truth or reveal less, at four different priors." },
    { beat: "See", text: "Drag how often you say guilty about the innocent. Convictions climb, then fall off a cliff." },
    { beat: "Prove", text: "New priors. Find the most you can say before the judge stops believing you." },
  ],
  math: [
    { label: "Belief after hearing guilty", expr: "p / (p + (1 - p) q)" },
    { label: "Judge convicts when", expr: "belief >= 1/2, so q <= p / (1 - p)" },
    { label: "Best policy convicts with chance", expr: "2p, up to 1" },
  ],
  remember: "Push the receiver's belief to exactly the point of indifference. More is wasted, and less leaves gains on the table.",
  practice: "A school that grades on a curve of letters, a regulator who stress tests banks, a recommender that mixes good and so-so results, ad targeting.",
  origin: "Emir Kamenica and Matthew Gentzkow, 2011.",
};

export const bayesianPersuasion: GameModule = { slug: "bayesian-persuasion", hook: "Can you steer them without lying?", create: (env) => new BayesianPersuasionGame(env), theory };
