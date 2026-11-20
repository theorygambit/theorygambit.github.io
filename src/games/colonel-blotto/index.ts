import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { ColonelBlottoGame } from "./ColonelBlottoGame";

const theory: TheoryEntry = {
  idea: "Two commanders split their troops over several fields. A field goes to whoever sends more, and the war goes to whoever holds more fields. Whatever split you pick, some other split beats it, so the best play is a mix.",
  taught: [
    { beat: "Feel", text: "Split 12 troops over three fields against four opponents, and see which split would have won." },
    { beat: "See", text: "Every split is a dot in a triangle. Tap an opponent to light up every split that beats it." },
    { beat: "Prove", text: "New troop totals. Give up the dearest field and spend just enough on the other two." },
  ],
  math: [
    { label: "A split is three counts that add up to your troops", expr: "a + b + c = T" },
    { label: "To beat an opponent (x, y, z) with x <= y <= z, hold the two cheapest fields", expr: "need (x + 1) + (y + 1) <= T" },
    { label: "Splits of 12 troops over three fields", expr: "91, and each one has a counter" },
  ],
  remember: "Concede the dearest field and win two cheap ones, but a pattern can be read, so mix.",
  practice: "Election campaigns, advertising budgets, security patrols and any contest where limited resources are spread over several fronts. Do not become predictable, and do not defend everything equally.",
  origin: "Introduced by Emile Borel in 1921. It was named Colonel Blotto in the 1950s.",
};

export const colonelBlotto: GameModule = { slug: "colonel-blotto", hook: "Where do you send your troops?", create: (env) => new ColonelBlottoGame(env), theory };
