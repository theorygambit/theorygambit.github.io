/**
 * n players. If at least one volunteers, everyone gets `benefit`. A volunteer pays `cost`.
 * Each of the others volunteers with chance p. Waiting pays benefit while someone else steps up.
 * In the symmetric mixed equilibrium you are indifferent: (1 - p)^(n - 1) = cost / benefit.
 */
export class Volunteer {
  readonly n: number;
  readonly benefit: number;
  readonly cost: number;

  constructor(n: number, benefit: number, cost: number) {
    this.n = n;
    this.benefit = benefit;
    this.cost = cost;
  }

  /** What you get for stepping up, whatever the others do. */
  get volunteerPay(): number {
    return this.benefit - this.cost;
  }

  /** Chance that every other player waits, when each steps up with chance p. */
  othersWait(p: number): number {
    return Math.pow(1 - p, this.n - 1);
  }

  /** Expected pay for waiting when each other steps up with chance p. */
  waitPay(p: number): number {
    return this.benefit * (1 - this.othersWait(p));
  }

  /** The chance each player steps up in the symmetric mixed equilibrium. */
  get pStar(): number {
    return 1 - Math.pow(this.cost / this.benefit, 1 / (this.n - 1));
  }

  /** Chance that nobody steps up when everyone plays p. */
  nobody(p: number): number {
    return Math.pow(1 - p, this.n);
  }

  /** Chance nobody helps at equilibrium. It rises with n toward cost / benefit. */
  get nobodyAtStar(): number {
    return Math.pow(this.cost / this.benefit, this.n / (this.n - 1));
  }

  with(n: number): Volunteer {
    return new Volunteer(n, this.benefit, this.cost);
  }

  /** How many of the other n - 1 players step up this round. */
  draw(rand: () => number, p: number): boolean[] {
    return Array.from({ length: this.n - 1 }, () => rand() < p);
  }
}

/** The Feel table: you and four others, a lamp worth 3 to each of you, costing 1 to fix. */
export const FEEL_GAME = new Volunteer(5, 3, 1);

export interface VolunteerPuzzle {
  game: Volunteer;
  answer: number;
}

const mk = (b: number, c: number, n: number): VolunteerPuzzle => {
  const g = new Volunteer(n, b, c);
  return { game: g, answer: g.pStar };
};

/** Prove cases, all with a clean answer. None is the Feel case. */
export const PROVE_POOL: readonly VolunteerPuzzle[] = [mk(4, 1, 3), mk(9, 1, 3), mk(8, 1, 4), mk(27, 1, 4), mk(9, 4, 3), mk(16, 1, 5), mk(27, 8, 4)];

export const PROVE_TOLERANCE = 0.06;

/** Two different puzzles, never the same twice and never the same answer twice. */
export function pickPuzzles(pick: <T>(items: readonly T[]) => T): VolunteerPuzzle[] {
  const a = pick(PROVE_POOL);
  let b = pick(PROVE_POOL);
  let guard = 0;
  while ((b === a || Math.abs(b.answer - a.answer) < 0.1) && guard++ < 50) b = pick(PROVE_POOL);
  return [a, b];
}
