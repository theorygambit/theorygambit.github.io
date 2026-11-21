export interface Lottery {
  /** [probability, prize] pairs. */
  parts: readonly (readonly [number, number])[];
}

/**
 * Pair one: A pays s for sure, B pays s with chance (1 - pH - pZ), h with pH and 0 with pZ.
 * Pair two: C pays s with chance (pH + pZ), D pays h with pH. Pair two is pair one with the common
 * (1 - pH - pZ) chance of s removed. An expected utility maximiser who picks A picks C, and B goes with D.
 */
export class Allais {
  readonly s: number;
  readonly h: number;
  readonly pH: number;
  readonly pZ: number;

  constructor(s: number, h: number, pH: number, pZ: number) {
    this.s = s;
    this.h = h;
    this.pH = pH;
    this.pZ = pZ;
  }

  get common(): number {
    return 1 - this.pH - this.pZ;
  }

  A(): Lottery {
    return { parts: [[1, this.s]] };
  }

  B(): Lottery {
    return { parts: [[this.common, this.s], [this.pH, this.h], [this.pZ, 0]] };
  }

  C(): Lottery {
    return { parts: [[this.pH + this.pZ, this.s], [this.common, 0]] };
  }

  D(): Lottery {
    return { parts: [[this.pH, this.h], [1 - this.pH, 0]] };
  }

  static expected(l: Lottery): number {
    return l.parts.reduce((a, [p, x]) => a + p * x, 0);
  }

  /** The pair two choice that goes with a pair one choice under expected utility. */
  consistent(first: "A" | "B"): "C" | "D" {
    return first === "A" ? "C" : "D";
  }

  /** Does expected utility prefer A for some utility of money? Only when the utility of s beats the gamble. */
  prefersA(uS: number, uH: number, uZ: number): boolean {
    return uS > this.common * uS + this.pH * uH + this.pZ * uZ;
  }

  prefersC(uS: number, uH: number, uZ: number): boolean {
    const c = (this.pH + this.pZ) * uS + this.common * uZ;
    const d = this.pH * uH + (1 - this.pH) * uZ;
    return c > d;
  }
}

/** The classic numbers, in millions. */
export const FEEL_ALLAIS = new Allais(1, 5, 0.1, 0.01);

export interface Case {
  game: Allais;
  first: "A" | "B";
}

/** New prizes and chances, with both starting choices. */
export const PROVE_POOL: readonly Case[] = [
  { game: new Allais(2, 8, 0.2, 0.05), first: "A" },
  { game: new Allais(3, 9, 0.15, 0.1), first: "B" },
  { game: new Allais(1, 4, 0.25, 0.05), first: "B" },
  { game: new Allais(4, 10, 0.1, 0.05), first: "A" },
];
