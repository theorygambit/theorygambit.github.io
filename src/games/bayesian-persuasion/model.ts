import type { Rng } from "../../core/Rng";

/**
 * A prosecutor wants a conviction. A share p of defendants are guilty. The prosecutor commits to a report policy:
 * say "guilty" for every guilty defendant, and for an innocent one with chance q. The judge convicts when the chance
 * of guilt, given the report, is at least one half.
 */
export class Persuasion {
  readonly p: number;

  constructor(p: number) {
    this.p = p;
  }

  /** Chance the report says guilty. */
  said(q: number): number {
    return this.p + (1 - this.p) * q;
  }

  /** Chance of guilt after hearing "guilty". */
  posterior(q: number): number {
    return this.p / this.said(q);
  }

  /** Chance of conviction. */
  convict(q: number): number {
    return this.posterior(q) >= 0.5 - 1e-9 ? this.said(q) : 0;
  }

  /** Revealing the truth: say guilty only for the guilty. */
  truth(): number {
    return this.convict(0);
  }

  /** The most the prosecutor can say about innocents before the judge stops convicting. */
  bestQ(): number {
    return this.p >= 0.5 ? 1 : this.p / (1 - this.p);
  }

  best(): number {
    return this.convict(this.bestQ());
  }
}

export const FEEL_PRIORS: readonly number[] = [0.3, 0.2, 0.4, 0.6];
export const SEE_PRIOR = 0.3;
export const PROVE_POOL: readonly number[] = [0.2, 0.25, 0.4];

export function proveSet(rng: Rng): Persuasion[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2).map((p) => new Persuasion(p));
}

export const isRight = (m: Persuasion, q: number, tol = 0.04): boolean => Math.abs(q - m.bestQ()) <= tol + 1e-9;
