import { Bimatrix } from "../shared/Bimatrix";
import type { Rng } from "../../core/Rng";

/**
 * A grid of shared scores. Both players get the same payoff in every cell, so the grid is its own
 * potential. A move that helps the mover raises the score for everyone, and a cell where neither can
 * raise it is an equilibrium.
 */
export class Potential {
  readonly phi: readonly (readonly number[])[];
  readonly game: Bimatrix;

  constructor(phi: readonly (readonly number[])[]) {
    this.phi = phi;
    this.game = new Bimatrix(phi, phi);
  }

  get n(): number {
    return this.phi.length;
  }

  /** Pure equilibria: best in their row and in their column. */
  equilibria(): [number, number][] {
    return this.game.equilibria();
  }

  /** The best single move for the row player in this column, or null if none helps. */
  rowMove(r: number, c: number): number | null {
    const best = this.game.bestRows(c)[0]!;
    return this.phi[best]![c]! > this.phi[r]![c]! ? best : null;
  }

  colMove(r: number, c: number): number | null {
    const best = this.game.bestCols(r)[0]!;
    return this.phi[r]![best]! > this.phi[r]![c]! ? best : null;
  }

  /** Walk uphill, row then column, until nobody can improve. */
  walk(r: number, c: number): [number, number][] {
    const path: [number, number][] = [[r, c]];
    for (let guard = 0; guard < 20; guard++) {
      const rm = this.rowMove(r, c);
      if (rm !== null) {
        r = rm;
        path.push([r, c]);
        continue;
      }
      const cm = this.colMove(r, c);
      if (cm !== null) {
        c = cm;
        path.push([r, c]);
        continue;
      }
      break;
    }
    return path;
  }
}

/** A grid with distinct values in every row and column and the requested number of equilibria. */
export function randomPotential(rng: Rng, want: number, n = 3): Potential {
  for (let tries = 0; tries < 50000; tries++) {
    const phi = Array.from({ length: n }, () => Array.from({ length: n }, () => rng.int(1, 9)));
    let ties = false;
    for (let i = 0; i < n; i++) {
      if (new Set(phi[i]!).size < n) ties = true;
      if (new Set(phi.map((row) => row[i]!)).size < n) ties = true;
    }
    if (ties) continue;
    const g = new Potential(phi);
    if (g.equilibria().length === want) return g;
  }
  throw new Error("no potential game found");
}

/** The Feel grid has two peaks, and a start in the corner walks to the lower one. */
export const FEEL_GRID = new Potential([[3, 6, 1], [5, 2, 8], [4, 9, 7]]);
