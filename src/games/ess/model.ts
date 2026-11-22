import type { Rng } from "../../core/Rng";

/**
 * A symmetric two strategy game. u(i, j) is what strategy i earns against strategy j. A strategy is
 * evolutionarily stable if, once common, it earns more against itself than any rare mutant does, or ties
 * and earns more against the mutant than the mutant does against itself.
 */
export class Sym {
  readonly u: readonly (readonly number[])[];

  constructor(a: number, b: number, c: number, d: number) {
    this.u = [[a, b], [c, d]];
  }

  pay(i: number, j: number): number {
    return this.u[i]![j]!;
  }

  /** Is strategy i a pure ESS? */
  isEss(i: number): boolean {
    const j = 1 - i;
    if (this.pay(i, i) > this.pay(j, i)) return true;
    return this.pay(i, i) === this.pay(j, i) && this.pay(i, j) > this.pay(j, j);
  }

  get ess(): number[] {
    return [0, 1].filter((i) => this.isEss(i));
  }

  /** The mutant's edge over the resident: what j earns against i minus what i earns against itself. */
  edge(resident: number, mutant: number): number {
    return this.pay(mutant, resident) - this.pay(resident, resident);
  }
}

/** Hawk and Dove with V = 2, C = 4: neither pure strategy resists invasion. Index 0 hawk, 1 dove. */
export const FEEL_GAME = new Sym(-1, 2, 0, 1);

/** A random table with no ties anywhere that matter and the requested number of pure ESS. */
export function randomSym(rng: Rng, want: number): Sym {
  for (let tries = 0; tries < 20000; tries++) {
    const g = new Sym(rng.int(0, 6), rng.int(0, 6), rng.int(0, 6), rng.int(0, 6));
    const tie = g.pay(0, 0) === g.pay(1, 0) || g.pay(1, 1) === g.pay(0, 1);
    if (tie) continue;
    if (g.ess.length === want) return g;
  }
  throw new Error("no table found");
}
