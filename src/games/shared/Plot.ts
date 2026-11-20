import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";

export interface PlotSpec {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Space kept inside the body for axis text. Defaults leave room for a y label above and tick and x labels below. */
  padL?: number;
  padR?: number;
  padT?: number;
  padB?: number;
  /** Cap on the plot height, so tall screens do not stretch it. */
  maxH?: number;
}

/**
 * A plot area sized from the frame body, with axes, ticks and curves drawn through the Painter.
 * The y label sits above the top edge, tick numbers and the x label sit below the base, all inside the body.
 */
export class Plot {
  x0 = 0;
  top = 0;
  w = 0;
  h = 0;
  private spec: Required<PlotSpec>;

  constructor(spec: PlotSpec) {
    this.spec = { padL: 24, padR: 24, padT: 28, padB: 54, maxH: 230, ...spec };
  }

  fit(f: Frame): this {
    const s = this.spec;
    this.x0 = f.x + s.padL;
    this.w = Math.max(40, f.w - s.padL - s.padR);
    this.top = f.top + s.padT;
    this.h = Math.max(70, Math.min(s.maxH, f.h - s.padT - s.padB));
    return this;
  }

  get base(): number {
    return this.top + this.h;
  }
  get right(): number {
    return this.x0 + this.w;
  }

  X = (v: number): number => this.x0 + ((v - this.spec.xMin) / (this.spec.xMax - this.spec.xMin)) * this.w;
  Y = (v: number): number => this.base - ((v - this.spec.yMin) / (this.spec.yMax - this.spec.yMin)) * this.h;
  /** Inverse of X, for pointer input. */
  valueAtX = (px: number): number => this.spec.xMin + ((px - this.x0) / this.w) * (this.spec.xMax - this.spec.xMin);
  valueAtY = (py: number): number => this.spec.yMin + ((this.base - py) / this.h) * (this.spec.yMax - this.spec.yMin);

  axes(p: Painter, c: Colors, o: { xTicks?: number[]; xLabel?: string; yLabel?: string; fmt?: (v: number) => string }): void {
    const fmt = o.fmt ?? ((v: number) => String(Math.round(v * 100) / 100));
    p.rule(this.x0, this.base, this.right, this.base, c.ink, 0.5);
    p.rule(this.x0, this.top, this.x0, this.base, c.ink, 0.5);
    for (const v of o.xTicks ?? []) {
      p.rule(this.X(v), this.base, this.X(v), this.base + 5, c.ink, 0.5);
      p.text(fmt(v), this.X(v), this.base + 20, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    if (o.yLabel) p.text(o.yLabel, this.x0, this.top - 8, { font: Type.body(12, 400), color: c.fog });
    if (o.xLabel) p.text(o.xLabel, this.right, this.base + 40, { font: Type.body(12, 400), color: c.fog, align: "right" });
  }

  curve(p: Painter, fn: (x: number) => number, color: string, lw = 1.5, alpha = 1, n = 60): void {
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const x = this.spec.xMin + (i / n) * (this.spec.xMax - this.spec.xMin);
      pts.push([this.X(x), this.Y(fn(x))]);
    }
    p.path(pts, color, lw, alpha);
  }
}
