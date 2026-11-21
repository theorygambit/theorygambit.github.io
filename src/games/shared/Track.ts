import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";

/** A horizontal track with ticks and one draggable marker. Values snap to `step`. */
export class Track {
  x0 = 0;
  x1 = 0;
  y = 0;
  min = 0;
  max = 1;
  step = 0.01;
  value = 0;

  fit(x0: number, x1: number, y: number): void {
    this.x0 = x0;
    this.x1 = x1;
    this.y = y;
  }

  xOf(v: number): number {
    return this.x0 + ((v - this.min) / (this.max - this.min)) * (this.x1 - this.x0);
  }

  /** The snapped value under a pointer x. */
  valueAt(x: number): number {
    const raw = this.min + ((x - this.x0) / (this.x1 - this.x0)) * (this.max - this.min);
    return clamp(Math.round(raw / this.step) * this.step, this.min, this.max);
  }

  set(x: number): void {
    this.value = this.valueAt(x);
  }

  /** Ruler, tick labels below, and nothing else. Markers and value labels are drawn by the game. */
  ruler(p: Painter, c: Colors, ticks: number[], fmt: (v: number) => string, alpha = 1): void {
    p.rule(this.x0, this.y, this.x1, this.y, c.ink, 0.5 * alpha);
    for (const v of ticks) {
      const x = this.xOf(v);
      p.rule(x, this.y - 5, x, this.y + 5, c.ink, 0.5 * alpha);
      p.text(fmt(v), x, this.y + 24, { font: Type.mono(10), color: c.ash, align: "center", alpha });
    }
  }

  marker(p: Painter, c: Colors, v: number, r = 9, alpha = 1): void {
    p.disc(this.xOf(v), this.y, r, c.ink, alpha);
  }
}
