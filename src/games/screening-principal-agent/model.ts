/**
 * A principal pays a bonus b if a project succeeds. The agent can work, at effort cost e, or shirk. Working
 * lifts the chance of success from pL to pH. The agent works when the extra expected bonus covers the
 * effort: b (pH - pL) >= e.
 */
export class Contract {
  readonly e: number;
  readonly pH: number;
  readonly pL: number;

  constructor(e: number, pH: number, pL: number) {
    this.e = e;
    this.pH = pH;
    this.pL = pL;
  }

  work(b: number): number {
    return b * this.pH - this.e;
  }

  shirk(b: number): number {
    return b * this.pL;
  }

  agentWorks(b: number): boolean {
    return this.work(b) >= this.shirk(b);
  }

  /** The smallest bonus that makes working worth it. */
  get minimum(): number {
    return this.e / (this.pH - this.pL);
  }
}

export const FEEL_CONTRACT = new Contract(2, 0.8, 0.4);

/** Bonuses offered in Feel: below, at and above the minimum of 5. */
export const FEEL_BONUSES: readonly number[] = [2, 5, 8];

export const PROVE_POOL: readonly Contract[] = [new Contract(3, 0.9, 0.5), new Contract(2, 0.9, 0.6), new Contract(1.5, 0.8, 0.2), new Contract(4, 0.9, 0.5)];

export const MAX_BONUS = 20;
export const PROVE_TOLERANCE = 0.5;
