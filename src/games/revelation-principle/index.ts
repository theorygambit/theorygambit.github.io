import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { RevelationPrincipleGame } from "./RevelationPrincipleGame";

const theory: TheoryEntry = {
  idea: "Any result a clever mechanism can reach, with players hiding and shading, can also be reached by a mechanism that simply asks everyone for their private information and then plays their best strategy for them. Honest reporting is then the best choice, so you only need to design among truthful mechanisms.",
  taught: [
    { beat: "Feel", text: "A first price auction. Bid your value or bid half, four times." },
    { beat: "See", text: "Drag your value. Bidding half yourself, or telling the truth to a machine that bids half for you, gives the same bid." },
    { beat: "Prove", text: "New strategies. Find the bid the machine places after you report your value." },
  ],
  math: [
    { label: "A strategy maps a value to a bid", expr: "b(v) = k v" },
    { label: "A direct mechanism asks for v and places", expr: "b(report)" },
    { label: "Reporting v truthfully gives the same outcome as bidding", expr: "b(v)" },
  ],
  remember: "Hiding and shading can be handed to the mechanism. Then everyone tells the truth, and the outcome is unchanged.",
  practice: "Design theory shortcuts. Instead of searching over every rule with every strategy, search only over rules where honesty is best.",
  origin: "Roger Myerson, 1979, with earlier versions by Gibbard (1973) and Dasgupta, Hammond and Maskin.",
};

export const revelationPrinciple: GameModule = { slug: "revelation-principle", hook: "Why can we assume everyone tells the truth?", create: (env) => new RevelationPrincipleGame(env), theory };
