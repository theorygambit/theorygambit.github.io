import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { fmt } from "./fmt";

/** A horizontal drag track with a "you" marker. Geometry is set by the game from the frame. */
export class Slider {
  x0 = 0;
  x1 = 0;
  y = 0;
  min = 0;
  max = 1;
  step = 0.01;
  value = 0;

  range(min: number, max: number, step: number): this {
    this.min = min;
    this.max = max;
    this.step = step;
    this.value = clamp(this.value, min, max);
    return this;
  }

  place(x0: number, x1: number, y: number): this {
    this.x0 = x0;
    this.x1 = x1;
    this.y = y;
    return this;
  }

  X(v: number): number {
    return this.x0 + ((v - this.min) / (this.max - this.min)) * (this.x1 - this.x0);
  }

  /** Move the marker to the pointer, snapped to the step. */
  setFromX(x: number): number {
    const t = clamp((x - this.x0) / (this.x1 - this.x0), 0, 1);
    const raw = this.min + t * (this.max - this.min);
    this.value = clamp(Math.round(raw / this.step) * this.step, this.min, this.max);
    this.value = Math.round(this.value * 1000) / 1000;
    return this.value;
  }

  /** A generous touch zone around the track, at least 44 css pixels tall. */
  hit(x: number, y: number): boolean {
    return x >= this.x0 - 24 && x <= this.x1 + 24 && Math.abs(y - this.y) <= 30;
  }

  draw(p: Painter, c: Colors, o: { ticks: number[]; label?: (v: number) => string; showValue?: boolean; alpha?: number; text?: (v: number) => string; ring?: boolean }): void {
    const a = o.alpha ?? 1;
    const lab = o.label ?? fmt;
    p.rule(this.x0, this.y, this.x1, this.y, c.ink, 0.5 * a);
    for (const v of o.ticks) {
      const x = this.X(v);
      p.rule(x, this.y - 5, x, this.y + 5, c.ink, 0.5 * a);
      p.text(lab(v), x, this.y + 24, { font: Type.mono(10), color: c.ash, align: "center", alpha: a });
    }
    const mx = this.X(this.value);
    if (o.showValue !== false) p.text((o.text ?? lab)(this.value), mx, this.y - 27, { font: Type.mono(12), color: c.ink, align: "center", alpha: a });
    if (o.ring) p.ring(mx, this.y, 9, c.ink, 1.5, a);
    else p.disc(mx, this.y, 9, c.ink, a);
  }
}
