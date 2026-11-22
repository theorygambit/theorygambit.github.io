import type { Rng } from "../../core/Rng";

export interface Pt {
  x: number;
  y: number;
}

/**
 * An endlessly repeated prisoner's dilemma with T > R > P > S. The average payoffs a patient pair can
 * reach are the points inside the hull of the four outcomes. A payoff is sustainable by threat when it
 * is feasible and beats the punishment level P for both players.
 */
export class Folk {
  readonly T: number;
  readonly R: number;
  readonly P: number;
  readonly S: number;

  constructor(T: number, R: number, P: number, S: number) {
    this.T = T;
    this.R = R;
    this.P = P;
    this.S = S;
  }

  /** Corners of the feasible set, in order around the hull. */
  get hull(): Pt[] {
    return [{ x: this.S, y: this.T }, { x: this.R, y: this.R }, { x: this.T, y: this.S }, { x: this.P, y: this.P }];
  }

  feasible(x: number, y: number): boolean {
    const h = this.hull;
    let sign = 0;
    for (let i = 0; i < h.length; i++) {
      const a = h[i]!;
      const b = h[(i + 1) % h.length]!;
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      if (Math.abs(cross) < 1e-9) continue;
      const s = Math.sign(cross);
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  }

  /** Both players beat the worst the other can do to them. */
  rational(x: number, y: number): boolean {
    return x > this.P && y > this.P;
  }

  sustainable(x: number, y: number): boolean {
    return this.feasible(x, y) && this.rational(x, y);
  }

  /** Why a point fails, or null when it is sustainable. */
  reason(x: number, y: number): "outside" | "punish" | null {
    if (!this.feasible(x, y)) return "outside";
    if (!this.rational(x, y)) return "punish";
    return null;
  }
}

export const FEEL_GAME = new Folk(5, 3, 1, 0);

export const PROVE_GAMES: readonly Folk[] = [new Folk(6, 4, 2, 0), new Folk(7, 3, 1, 0), new Folk(8, 5, 2, 0)];

/** Points whose answer is clear, at least 0.4 from any boundary, with both answers present. */
export function proveQuestions(rng: Rng): { game: Folk; x: number; y: number }[] {
  const out: { game: Folk; x: number; y: number }[] = [];
  const game = rng.pick(PROVE_GAMES);
  const want = [true, false, false];
  for (const yes of rng.shuffle(want)) {
    for (let tries = 0; tries < 5000; tries++) {
      const x = Math.round(rng.range(0.2, game.T) * 2) / 2;
      const y = Math.round(rng.range(0.2, game.T) * 2) / 2;
      if (game.sustainable(x, y) !== yes) continue;
      if (clearOf(game, x, y)) {
        out.push({ game, x, y });
        break;
      }
    }
  }
  return out;
}

function clearOf(g: Folk, x: number, y: number): boolean {
  const eps = 0.4;
  for (const [dx, dy] of [[eps, 0], [-eps, 0], [0, eps], [0, -eps]] as const) {
    if (g.sustainable(x + dx, y + dy) !== g.sustainable(x, y)) return false;
  }
  return Math.abs(x - g.P) > 0.25 && Math.abs(y - g.P) > 0.25;
}
