/**
 * A design lever, pressure x from 0 to 1: nags, streaks, timers, variable rewards.
 * Engagement is what the designer measures and it only rises. What the player gains rises
 * with it for a while, then falls as the pressure costs more than the play gives.
 */
export class Design {
  readonly k: number;
  readonly cost: number;

  constructor(k: number, cost: number) {
    this.k = k;
    this.cost = cost;
  }

  engagement(x: number): number {
    return 1 - Math.exp(-this.k * x);
  }

  benefit(x: number): number {
    return Math.max(0, this.engagement(x) - this.cost * x * x);
  }

  /** The pressure at which the player gains most. Where care stops being the same as engagement. */
  get care(): number {
    let best = 0;
    let at = 0;
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      const b = this.benefit(x);
      if (b > best) {
        best = b;
        at = x;
      }
    }
    return at;
  }
}

export const FEEL_DESIGN = new Design(3.2, 0.9);
/** Three builds the player tries in Feel. */
export const BUILDS: readonly { name: string; x: number }[] = [
  { name: "Gentle", x: 0.2 },
  { name: "Standard", x: 0.5 },
  { name: "Pushy", x: 0.95 },
];

/** New products for Prove. The best setting for the player moves each time. */
export const PROVE_DESIGNS: readonly Design[] = [new Design(5, 0.9), new Design(2.2, 0.55)];
export const PROVE_TOLERANCE = 0.09;
