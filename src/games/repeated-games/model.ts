import type { Rng } from "../../core/Rng";

export type Move = "hold" | "break";

/**
 * A prisoner's dilemma played again and again against a grim opponent, who holds until you
 * break once and then breaks forever. T is the temptation, R the reward, P the punishment.
 * `d` is patience: how much the next round is worth compared with this one.
 */
export class RepeatedDilemma {
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

  /** [you, them] for one round. */
  payoff(you: Move, them: Move): [number, number] {
    if (you === "hold" && them === "hold") return [this.R, this.R];
    if (you === "break" && them === "break") return [this.P, this.P];
    if (you === "break") return [this.T, this.S];
    return [this.S, this.T];
  }

  /** Worth of holding in every round, forever. */
  holdValue(d: number): number {
    return this.R / (1 - d);
  }

  /** Worth of breaking now: the temptation once, then the punishment forever. */
  breakValue(d: number): number {
    return this.T + (d * this.P) / (1 - d);
  }

  /** The patience at which the two are worth the same. */
  get threshold(): number {
    return (this.T - this.R) / (this.T - this.P);
  }

  sustainable(d: number): boolean {
    return d >= this.threshold - 1e-12;
  }

  /** What one round pays on the stream "hold forever" or "break now", counting from round 0. */
  stream(kind: "hold" | "break", t: number): number {
    return kind === "hold" ? this.R : t === 0 ? this.T : this.P;
  }
}

/** Holds until you break once, then breaks in every round after. */
export class GrimOpponent {
  turned = false;

  move(): Move {
    return this.turned ? "break" : "hold";
  }

  observe(you: Move): void {
    if (you === "break") this.turned = true;
  }
}

export const FEEL_CASE = new RepeatedDilemma(5, 3, 1);
export const FEEL_ROUNDS = 8;

/** Prove cases with different thresholds, none of them the Feel one (one half). */
export const PROVE_POOL: readonly { T: number; R: number; P: number }[] = [
  { T: 7, R: 5, P: 1 },
  { T: 6, R: 3, P: 1 },
  { T: 9, R: 4, P: 1 },
  { T: 8, R: 6, P: 2 },
  { T: 6, R: 4, P: 1 },
];

export const PROVE_TOLERANCE = 0.06;

/** Two cases with clearly different thresholds. `avoid` is the key of the last pair, so a replay differs. */
export function proveSet(rng: Rng, avoid = ""): { games: RepeatedDilemma[]; key: string } {
  for (let tries = 0; tries < 60; tries++) {
    const [a, b] = rng.shuffle(PROVE_POOL);
    const ga = new RepeatedDilemma(a!.T, a!.R, a!.P);
    const gb = new RepeatedDilemma(b!.T, b!.R, b!.P);
    const key = [a, b].map((x) => `${x!.T}${x!.R}${x!.P}`).sort().join("|");
    if (Math.abs(ga.threshold - gb.threshold) >= 0.1 && key !== avoid) return { games: [ga, gb], key };
  }
  const ga = new RepeatedDilemma(7, 5, 1);
  const gb = new RepeatedDilemma(6, 3, 1);
  return { games: [ga, gb], key: "751|631" };
}
