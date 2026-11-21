import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { TremblingHandGame } from "./TremblingHandGame";

const theory: TheoryEntry = {
  idea: "Suppose each player's hand might slip a little. An equilibrium that rests on a weakly dominated move, one that only ties and sometimes loses, falls apart. Only equilibria that hold when mistakes are rare survive. That is trembling hand perfection.",
  taught: [
    { beat: "Feel", text: "The other player means Right but may slip to Left. Pick Top or Bottom five times and see what a slip does." },
    { beat: "See", text: "Drag the chance of a slip. Top ties Bottom at zero and pulls ahead as slips grow." },
    { beat: "Prove", text: "New tables with two stable cells. Tap the one that survives a slip." },
  ],
  math: [
    { label: "Bottom is weakly dominated by Top when", expr: "u(Top, s) >= u(Bottom, s) for every s, and > for some s" },
    { label: "With slip chance e", expr: "u(Top) - u(Bottom) = e (u(Top, slip) - u(Bottom, slip))" },
    { label: "Perfect equilibria", expr: "stable cells with no weakly dominated move" },
  ],
  remember: "A stable cell can be fragile. If it rests on a move that only ties, a small slip breaks it.",
  practice: "Checking that a plan still works when the other side makes small errors, such as a misread signal, a late reply or a mis-click.",
  origin: "Reinhard Selten, 1975. He refined Nash equilibrium by requiring it to be the limit of equilibria with small mistakes.",
};

export const tremblingHand: GameModule = { slug: "trembling-hand", hook: "What if their hand shakes?", create: (env) => new TremblingHandGame(env), theory };
