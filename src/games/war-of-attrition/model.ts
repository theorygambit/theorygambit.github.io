/**
 * Two players wait. Each tick costs c. When one quits, the other wins the prize V. Against a rival who
 * quits with chance p each tick, holding one more tick is worth p V - c. You are indifferent at p = c / V.
 */
export class Attrition {
  readonly V: number;
  readonly c: number;

  constructor(V: number, c: number) {
    this.V = V;
    this.c = c;
  }

  holdValue(p: number): number {
    return p * this.V - this.c;
  }

  /** The rival quit chance per tick that leaves you indifferent. */
  get indifference(): number {
    return this.c / this.V;
  }

  /** Average number of ticks until someone quits, if each of two players quits at rate p. */
  expectedTicks(p: number): number {
    return 1 / (1 - (1 - p) * (1 - p));
  }
}

export const FEEL_ATTRITION = new Attrition(10, 1);

/** The rival's quit chance per tick in Feel. */
export const FEEL_RIVAL = 0.1;

export const MAX_TICKS = 8;

/** New prizes and costs, with indifference points away from Feel's 0.10. */
export const PROVE_POOL: readonly Attrition[] = [new Attrition(10, 2), new Attrition(8, 3), new Attrition(20, 3), new Attrition(6, 1.5)];

export const PROVE_TOLERANCE = 0.04;
