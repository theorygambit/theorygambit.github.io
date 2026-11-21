/**
 * A shared pot. Each player holds 1 coin and may invest it. The pot is multiplied by r and shared
 * equally by all n players. An invested coin returns r/n to you, so investing pays only while n < r.
 */
export class PublicGood {
  readonly r: number;

  constructor(r: number) {
    this.r = r;
  }

  returnPerCoin(n: number): number {
    return this.r / n;
  }

  investPays(n: number): boolean {
    return this.returnPerCoin(n) > 1;
  }

  /** Your payoff for investing or keeping, given how many of the others invest. */
  payoff(n: number, invest: boolean, othersInvesting: number): number {
    return (invest ? 0 : 1) + (this.r * (othersInvesting + (invest ? 1 : 0))) / n;
  }

  /** The most players for which investing alone still pays. */
  maxPlayers(): number {
    return Math.ceil(this.r) - 1;
  }

  /** What everyone gets if all invest, against what everyone gets if none do. */
  allInvest(n: number): number {
    return (this.r * n) / n;
  }
}

export const FEEL_R = 1.6;
export const FEEL_SCENES: readonly { n: number; label: string }[] = [
  { n: 1, label: "Alone" },
  { n: 2, label: "One other player" },
  { n: 5, label: "Four other players" },
];

/** Prove: new multipliers. The player finds the largest group where investing still pays. */
export const PROVE_R: readonly number[] = [3, 5.5];
export const MAX_PLAYERS = 8;
