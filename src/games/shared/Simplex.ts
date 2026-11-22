import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import type { Frame } from "../../core/Game";
import { clamp } from "../../core/math";

/** A triangle of three-way splits. Corner i holds all of the total for player i + 1. */
export class Simplex {
  total = 12;
  side = 200;
  ax = 0;
  ay = 0;
  bx = 0;
  by = 0;
  cx = 0;
  cy = 0;

  fit(f: Frame, mid: number, total: number): void {
    this.total = total;
    this.side = clamp(Math.min(f.w - 70, (f.h - 80) / 0.866), 120, 300);
    const h = this.side * 0.866;
    this.ax = mid;
    this.ay = f.top + 30;
    this.bx = mid - this.side / 2;
    this.by = this.ay + h;
    this.cx = mid + this.side / 2;
    this.cy = this.by;
  }

  point(x: readonly number[]): [number, number] {
    const t = this.total;
    return [(x[0]! * this.ax + x[1]! * this.bx + x[2]! * this.cx) / t, (x[0]! * this.ay + x[1]! * this.by + x[2]! * this.cy) / t];
  }

  /** The split under a pixel, clamped to the triangle. */
  split(px: number, py: number): [number, number, number] {
    const d = (this.by - this.cy) * (this.ax - this.cx) + (this.cx - this.bx) * (this.ay - this.cy);
    let l1 = ((this.by - this.cy) * (px - this.cx) + (this.cx - this.bx) * (py - this.cy)) / d;
    let l2 = ((this.cy - this.ay) * (px - this.cx) + (this.ax - this.cx) * (py - this.cy)) / d;
    l1 = clamp(l1, 0, 1);
    l2 = clamp(l2, 0, 1 - l1);
    const l3 = 1 - l1 - l2;
    return [l1 * this.total, l2 * this.total, l3 * this.total];
  }

  draw(p: Painter, c: Colors): void {
    p.line(this.ax, this.ay, this.bx, this.by, c.ink, 1, 0.5);
    p.line(this.bx, this.by, this.cx, this.cy, c.ink, 1, 0.5);
    p.line(this.cx, this.cy, this.ax, this.ay, c.ink, 1, 0.5);
    p.text("1", this.ax, this.ay - 14, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text("2", this.bx - 14, this.by + 4, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text("3", this.cx + 14, this.cy + 4, { font: Type.mono(11), color: c.fog, align: "center" });
  }
}
