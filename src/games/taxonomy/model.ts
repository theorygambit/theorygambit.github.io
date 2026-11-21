import type { Rng } from "../../core/Rng";

export type Timing = "together" | "inTurns";
export type Sum = "zero" | "nonzero";

export interface Scene {
  name: string;
  timing: Timing;
  sum: Sum;
  why: string;
}

/** Top row is zero-sum, bottom row is not. Left column is at once, right column is in turns. */
export const quadrantOf = (s: Scene): number => (s.sum === "zero" ? 0 : 2) + (s.timing === "together" ? 0 : 1);

export const FEEL_SCENES: readonly Scene[] = [
  { name: "Chess", timing: "inTurns", sum: "zero", why: "Players take turns, and a win for one is a loss for the other." },
  { name: "Matching coins", timing: "together", sum: "zero", why: "Both reveal at once, and one side's win is the other's loss." },
  { name: "Price setting", timing: "together", sum: "nonzero", why: "Shops choose at once, and both can gain or lose together." },
  { name: "Haggling", timing: "inTurns", sum: "nonzero", why: "Offers go back and forth, and a deal can leave both better off." },
];

export const PROVE_POOL: readonly Scene[] = [
  { name: "Penalty kick", timing: "together", sum: "zero", why: "Kicker and keeper pick at once, and a goal is one side's gain." },
  { name: "Sealed auction", timing: "together", sum: "nonzero", why: "Bids are secret and at once, and the item can be worth more to the winner." },
  { name: "Checkers", timing: "inTurns", sum: "zero", why: "Moves alternate, and only one player wins." },
  { name: "Job offer", timing: "inTurns", sum: "nonzero", why: "Offer then reply, and both sides can come out ahead." },
  { name: "Tic tac toe", timing: "inTurns", sum: "zero", why: "Moves alternate, and a win for one is a loss for the other." },
  { name: "Choosing a lane", timing: "together", sum: "nonzero", why: "Drivers choose at once, and a crash hurts both." },
];

/** Three scenes from the pool that cover at least three of the four corners. */
export function proveScenes(rng: Rng): Scene[] {
  for (let tries = 0; tries < 200; tries++) {
    const pick = rng.shuffle(PROVE_POOL).slice(0, 3);
    if (new Set(pick.map(quadrantOf)).size >= 3) return pick;
  }
  return [PROVE_POOL[0]!, PROVE_POOL[3]!, PROVE_POOL[1]!];
}
