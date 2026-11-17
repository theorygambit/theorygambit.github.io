/** What the Theory window shows for a game. Plain language, one idea per field. */
export interface TheoryEntry {
  /** One sentence statement of the idea. */
  idea: string;
  /** How the game teaches it, one line per beat. */
  taught: { beat: "Feel" | "See" | "Prove"; text: string }[];
  /** Formulas as plain unicode text. */
  math: { label: string; expr: string }[];
  /** The sentence to remember. */
  remember: string;
  /** Where it shows up in games, design and life. */
  practice: string;
  /** Origin and key reference. */
  origin: string;
}
