export type Move = "hold" | "break";

/**
 * The payoffs of a symmetric 2x2 game from one player's side:
 * T temptation (you break, they hold), R reward (both hold),
 * P punishment (both break), S sucker (you hold, they break).
 * It is a dilemma exactly when T > R > P > S.
 */
export class Dilemma {
  readonly T: number;
  readonly R: number;
  readonly P: number;
  readonly S: number;

  constructor(T = 5, R = 3, P = 1, S = 0) {
    this.T = T;
    this.R = R;
    this.P = P;
    this.S = S;
  }

  with(patch: Partial<{ T: number; R: number; P: number; S: number }>): Dilemma {
    return new Dilemma(patch.T ?? this.T, patch.R ?? this.R, patch.P ?? this.P, patch.S ?? this.S);
  }

  /** [you, them] */
  payoff(you: Move, them: Move): [number, number] {
    if (you === "hold" && them === "hold") return [this.R, this.R];
    if (you === "break" && them === "break") return [this.P, this.P];
    if (you === "break") return [this.T, this.S];
    return [this.S, this.T];
  }

  /** Strictly better move for you against a move of theirs, or null on a tie. */
  bestReply(them: Move): Move | null {
    const h = this.payoff("hold", them)[0];
    const b = this.payoff("break", them)[0];
    return h === b ? null : h > b ? "hold" : "break";
  }

  isDilemma(): boolean {
    return this.T > this.R && this.R > this.P && this.P > this.S;
  }

  breakIsDominant(): boolean {
    return this.bestReply("hold") === "break" && this.bestReply("break") === "break";
  }

  /** Both holding is stable when neither player gains by breaking alone. */
  holdIsEquilibrium(): boolean {
    return this.R >= this.T;
  }

  /** True when outcome a leaves both players strictly better off than outcome b. */
  paretoBetter(a: [Move, Move], b: [Move, Move]): boolean {
    const pa = this.payoff(a[0], a[1]);
    const pb = this.payoff(b[0], b[1]);
    return pa[0] > pb[0] && pa[1] > pb[1];
  }
}

/** Strangers in the Feel round: two hold and one breaks, in a random order. */
export function strangerMoves(shuffle: <T>(a: readonly T[]) => T[]): Move[] {
  return shuffle<Move>(["hold", "break", "hold"]);
}
