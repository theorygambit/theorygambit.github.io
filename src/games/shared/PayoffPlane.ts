import type { Colors } from "../../core/Palette";
import type { Frame } from "../../core/Game";
import { Type, type Painter } from "../../core/Painter";

/**
 * A plane of outcomes: what you get on the x axis, what they get on the y axis. A wide rectangle,
 * so labels have room, with margins so points never touch an axis. Shared by the sum games and
 * Pareto efficiency. All text goes through Painter so the layout auditor sees it.
 */
export class PayoffPlane {
  x0 = 0;
  y0 = 0;
  W = 0;
  H = 0;
  max = 10;
  private readonly padX = 40;
  private readonly padY = 34;

  fit(f: Frame, max = 10): void {
    this.max = max;
    this.W = f.w - 24;
    this.H = Math.max(110, f.h - 52);
    this.x0 = f.x + 12;
    this.y0 = f.top + 22;
  }

  px(you: number, they: number): [number, number] {
    const iw = this.W - 2 * this.padX;
    const ih = this.H - 2 * this.padY;
    return [this.x0 + this.padX + (you / this.max) * iw, this.y0 + this.H - this.padY - (they / this.max) * ih];
  }

  /** Pixel to payoff values. */
  inv(x: number, y: number): [number, number] {
    const iw = this.W - 2 * this.padX;
    const ih = this.H - 2 * this.padY;
    return [((x - this.x0 - this.padX) / iw) * this.max, ((this.y0 + this.H - this.padY - y) / ih) * this.max];
  }

  axes(p: Painter, c: Colors, alpha = 1): void {
    p.rule(this.x0, this.y0, this.x0, this.y0 + this.H, c.ink, 0.5 * alpha);
    p.rule(this.x0, this.y0 + this.H, this.x0 + this.W, this.y0 + this.H, c.ink, 0.5 * alpha);
    p.text("They get", this.x0, this.y0 - 10, { font: Type.body(12, 400), color: c.fog, alpha });
    p.text("You get", this.x0 + this.W, this.y0 + this.H + 20, { font: Type.body(12, 400), color: c.fog, align: "right", alpha });
  }

  /** The line you + they = sum, drawn from edge to edge of the data area. */
  sumLine(p: Painter, c: Colors, sum: number, alpha = 1, lw = 1.5, dash?: number[]): void {
    const a = Math.max(0, sum - this.max);
    const b = Math.min(sum, this.max);
    const [x1, y1] = this.px(a, sum - a);
    const [x2, y2] = this.px(b, sum - b);
    p.line(x1, y1, x2, y2, c.ink, lw, alpha, dash);
  }

  /** Shades the part of the plane up and to the right of a point. */
  quadrant(p: Painter, c: Colors, you: number, they: number, alpha = 1): void {
    const [x1, y1] = this.px(you, they);
    const [x2, y2] = this.px(this.max, this.max);
    p.rect(x1, y2, x2 - x1, y1 - y2, c.ink, 0.07 * alpha);
  }
}
