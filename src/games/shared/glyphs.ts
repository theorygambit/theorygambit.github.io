import type { Colors } from "../../core/Palette";
import type { Painter } from "../../core/Painter";

/**
 * The visual grammar of the whole app: you are the filled disc, the other
 * player is the ring, and a payoff is the area of a disc.
 */
export const Glyph = {
  you(p: Painter, c: Colors, x: number, y: number, r = 5, alpha = 1): void {
    p.disc(x, y, r, c.ink, alpha);
  },
  other(p: Painter, c: Colors, x: number, y: number, r = 6, alpha = 1): void {
    p.ring(x, y, r, c.ink, 1.5, alpha);
  },
  /** A tick mark that is filled once its step is done. */
  step(p: Painter, c: Colors, x: number, y: number, done: boolean, active: boolean): void {
    p.disc(x, y, 3, c.ground);
    if (done) p.disc(x, y, 3, c.ink);
    else p.ring(x, y, 3, c.ink, 1, active ? 1 : 0.35);
  },
};
