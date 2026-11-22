import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { EllsbergAmbiguityGame } from "./EllsbergAmbiguityGame";

const theory: TheoryEntry = {
  idea: "People avoid bets with unknown odds even when the unknown odds are fair on average. In an urn with 30 red and 60 black or yellow balls, most people prefer betting on red to black, and also black or yellow to red or yellow. No single belief about the black count supports both.",
  taught: [
    { beat: "Feel", text: "Bet on a known urn or an unknown one. The unknown mix is shown afterwards." },
    { beat: "See", text: "Drag your guess for the black count. Red against black flips, and the other pair flips the other way." },
    { beat: "Prove", text: "Given a guess, say which bet wins more often." },
  ],
  math: [
    { label: "Chance of the four bets", expr: "red 30/90, black k/90, red or yellow (90-k)/90, black or yellow 60/90" },
    { label: "Red beats black when", expr: "k < 30" },
    { label: "Red or yellow beats black or yellow when", expr: "k < 30 as well" },
  ],
  remember: "Choosing red and black or yellow together means no belief fits. That is a preference for known odds.",
  practice: "Why people hold cash, avoid new markets, and pay for certainty about the odds, not just low risk.",
  origin: "Daniel Ellsberg, 1961.",
};

export const ellsbergAmbiguity: GameModule = { slug: "ellsberg-ambiguity", hook: "Why do we avoid odds we cannot see?", create: (env) => new EllsbergAmbiguityGame(env), theory };
