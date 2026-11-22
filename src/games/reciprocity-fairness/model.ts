import type { Rng } from "../../core/Rng";

export type Verdict = "reward" | "punish" | "neutral";

/**
 * A gift from a stranger. `given` is what you received and `alt` is what they could have given instead.
 * People judge the choice, not only the result: kindness is what was given beyond what was available.
 */
export class Gift {
  readonly given: number;
  readonly alt: number;

  constructor(given: number, alt: number) {
    this.given = given;
    this.alt = alt;
  }

  /** Positive when they chose to give more than they had to. */
  get kindness(): number {
    return this.given - this.alt;
  }

  /** The reply a norm of reciprocity asks for. */
  get verdict(): Verdict {
    return this.kindness > 0 ? "reward" : this.kindness < 0 ? "punish" : "neutral";
  }

  /** A typical response from -3 (punish hard) to 3 (reward well). */
  get typical(): number {
    return Math.max(-3, Math.min(3, Math.round(this.kindness / 1.5)));
  }
}

/**
 * Four strangers. A kind choice, a forced gift of the same size, an unkind choice that still left you holding 2,
 * and a kind choice that left you with the same 2.
 */
export const FEEL_GIFTS: readonly Gift[] = [new Gift(5, 2), new Gift(5, 5), new Gift(2, 5), new Gift(2, 0)];

/** Three new gifts. One is big but unkind and one is small but kind, so the result and the intention disagree. */
export function proveGifts(rng: Rng): Gift[] {
  const g1 = rng.int(4, 6);
  const big = new Gift(g1, Math.min(9, g1 + rng.int(1, 3)));
  const g2 = rng.int(1, 2);
  const small = new Gift(g2, rng.int(0, g2 - 1));
  const g3 = rng.int(2, 5);
  const delta = rng.int(1, 3);
  const third = rng.chance(0.5) ? new Gift(g3, Math.min(9, g3 + delta)) : new Gift(g3 + delta, g3);
  return rng.shuffle([big, small, third]);
}

/** Share of your replies that followed the intention, not the size of the gift. */
export function followedIntention(gifts: readonly Gift[], replies: readonly number[]): number {
  return replies.filter((r, i) => Math.sign(r) === Math.sign(gifts[i]!.kindness)).length;
}
