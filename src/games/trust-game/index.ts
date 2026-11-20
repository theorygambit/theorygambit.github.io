import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { TrustGame } from "./TrustGame";

const theory: TheoryEntry = {
  idea: "You send money to a stranger, the amount grows on the way, and the stranger decides how much to send back. Nothing forces them. Trust is worth it only if enough comes back, and the break even point is one over the multiplier.",
  taught: [
    { beat: "Feel", text: "Send coins to four strangers. The pot triples and each stranger decides what to return." },
    { beat: "See", text: "For each stranger, the coins you sent against the coins that came back. Trust paid only above a third." },
    { beat: "Prove", text: "The pot now multiplies by a new number. Drag the share they return until the two areas match." },
  ],
  math: [
    { label: "Pot after sending s", expr: "pot = m × s" },
    { label: "You end with", expr: "10 - s + r × m × s, where r is the share returned" },
    { label: "Break even", expr: "r × m × s = s, so r = 1 / m" },
    { label: "With m = 3", expr: "trust pays above r = 1/3" },
  ],
  remember: "Trust pays when they return more than one over the multiplier.",
  practice: "Lending, investing in a partner, paying before delivery and sharing data all work this way. Reputation and repeated dealings raise the share people expect back, and so raise how much they are willing to send.",
  origin: "Berg, Dickhaut and McCabe (1995). A purely selfish stranger returns nothing and a purely selfish sender sends nothing, yet most people send half and get back about as much as they sent.",
};

export const trustGame: GameModule = {
  slug: "trust-game",
  hook: "How much do you send a stranger who may keep it?",
  create: (env) => new TrustGame(env),
  theory,
};
