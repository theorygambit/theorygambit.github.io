import type { Frame } from "../../core/Game";
import type { Box } from "../../core/Geometry";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";

export interface CellStyle {
  alpha?: number;
  /** Show your disc and number. */
  you?: boolean;
  /** Show their ring and number. */
  ring?: boolean;
  /** Hairline halos for a best reply. */
  youBest?: number;
  ringBest?: number;
  /** A faint wash behind the cell. */
  wash?: number;
  /** Dashed counterfactual rings instead of solid shapes. */
  dashed?: boolean;
}

/**
 * An N by M payoff table sized from the frame body. Rows are yours, columns are theirs. A cell holds a
 * disc (your payoff) and a ring (theirs), each with its area carrying the value and its number in the corner.
 */
export class GridView {
  rows: number;
  cols: number;
  cellW = 90;
  cellH = 60;
  x0 = 0;
  y0 = 0;
  readonly labelW = 44;
  readonly headH = 44;
  maxV: number;

  constructor(rows: number, cols: number, maxV = 9) {
    this.rows = rows;
    this.cols = cols;
    this.maxV = maxV;
  }

  /** Fit inside the body. `rightPad` and `bottomPad` leave room for margin numbers. */
  fit(f: Frame, rightPad = 0, bottomPad = 0): void {
    this.cellW = Math.floor(Math.max(48, Math.min(108, (f.w - this.labelW - rightPad) / this.cols)));
    this.cellH = Math.floor(Math.max(34, Math.min(84, (f.h - this.headH - bottomPad) / this.rows)));
    const total = this.labelW + this.cols * this.cellW + rightPad;
    this.x0 = Math.round(f.x + (f.w - total) / 2 + this.labelW);
    const free = f.h - this.headH - bottomPad - this.rows * this.cellH;
    this.y0 = Math.round(f.top + this.headH + Math.max(0, free) / 2);
  }

  get right(): number {
    return this.x0 + this.cols * this.cellW;
  }

  get bottom(): number {
    return this.y0 + this.rows * this.cellH;
  }

  rect(r: number, c: number): Box {
    return { x: this.x0 + c * this.cellW, y: this.y0 + r * this.cellH, w: this.cellW, h: this.cellH };
  }

  rowStrip(r: number): Box {
    return { x: this.x0 - this.labelW, y: this.y0 + r * this.cellH, w: this.labelW + this.cols * this.cellW, h: this.cellH };
  }

  colStrip(c: number): Box {
    return { x: this.x0 + c * this.cellW, y: this.y0 - this.headH, w: this.cellW, h: this.headH + this.rows * this.cellH };
  }

  rowLabelBox(r: number): Box {
    return { x: this.x0 - this.labelW, y: this.y0 + r * this.cellH, w: this.labelW, h: this.cellH };
  }

  colLabelBox(c: number): Box {
    return { x: this.x0 + c * this.cellW, y: this.y0 - this.headH, w: this.cellW, h: this.headH };
  }

  /** Which cell is under the point, if any. */
  cellAt(x: number, y: number): [number, number] | null {
    if (x < this.x0 || y < this.y0 || x >= this.right || y >= this.bottom) return null;
    return [Math.floor((y - this.y0) / this.cellH), Math.floor((x - this.x0) / this.cellW)];
  }

  get maxR(): number {
    return Math.max(4, Math.min(this.cellW * 0.2, this.cellH * 0.25, this.cellH * 0.6 - 24));
  }

  radius(v: number): number {
    return v <= 0 ? 0 : this.maxR * Math.sqrt(Math.min(1, v / this.maxV));
  }

  youPos(r: number, c: number): { x: number; y: number } {
    const b = this.rect(r, c);
    return { x: b.x + b.w * 0.27, y: b.y + b.h * 0.4 };
  }

  ringPos(r: number, c: number): { x: number; y: number } {
    const b = this.rect(r, c);
    return { x: b.x + b.w * 0.73, y: b.y + b.h * 0.4 };
  }

  grid(p: Painter, c: Colors, alpha = 1): void {
    p.frame(this.x0, this.y0, this.cols * this.cellW, this.rows * this.cellH, c.ink, 0.3 * alpha);
    for (let i = 1; i < this.cols; i++) p.rule(this.x0 + i * this.cellW, this.y0, this.x0 + i * this.cellW, this.bottom, c.ink, 0.3 * alpha);
    for (let i = 1; i < this.rows; i++) p.rule(this.x0, this.y0 + i * this.cellH, this.right, this.y0 + i * this.cellH, c.ink, 0.3 * alpha);
  }

  rowLabel(p: Painter, c: Colors, r: number, text: string, o: { alpha?: number; on?: boolean } = {}): void {
    p.text(text, this.x0 - 10, this.y0 + (r + 0.5) * this.cellH, { font: Type.body(15, 400), color: o.on ? c.ink : c.fog, align: "right", base: "middle", alpha: o.alpha ?? 1 });
  }

  colLabel(p: Painter, c: Colors, col: number, text: string, o: { alpha?: number; on?: boolean } = {}): void {
    p.text(text, this.x0 + (col + 0.5) * this.cellW, this.y0 - 14, { font: Type.body(15, 400), color: o.on ? c.ink : c.fog, align: "center", base: "middle", alpha: o.alpha ?? 1 });
  }

  /** A small mono number beside a label, such as the order a row was struck. */
  rowTag(p: Painter, c: Colors, r: number, text: string, alpha = 1): void {
    p.text(text, this.x0 - 28, this.y0 + (r + 0.5) * this.cellH, { font: Type.mono(11), color: c.ash, align: "right", base: "middle", alpha });
  }

  colTag(p: Painter, c: Colors, col: number, text: string, alpha = 1): void {
    p.text(text, this.x0 + (col + 0.5) * this.cellW, this.y0 - 33, { font: Type.mono(11), color: c.ash, align: "center", base: "middle", alpha });
  }

  cell(p: Painter, c: Colors, r: number, col: number, mine: number, theirs: number, s: CellStyle = {}): void {
    const a = s.alpha ?? 1;
    if (a < 0.02) return;
    const b = this.rect(r, col);
    if (s.wash) p.rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, c.ink, s.wash * a);
    const base = b.y + b.h - 6;
    if (s.you !== false) {
      const q = this.youPos(r, col);
      const rad = this.radius(mine);
      if (s.dashed) p.dashedRing(q.x, q.y, Math.max(3, rad), c.ink, 0.8 * a);
      else p.disc(q.x, q.y, rad, c.ink, 0.92 * a);
      if (s.youBest) p.ring(q.x, q.y, this.maxR + 3, c.ink, 1, s.youBest * a);
      p.text(String(mine), q.x, base, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    }
    if (s.ring !== false) {
      const q = this.ringPos(r, col);
      const rad = this.radius(theirs);
      if (s.dashed) p.dashedRing(q.x, q.y, Math.max(3, rad), c.ink, 0.8 * a);
      else p.ring(q.x, q.y, rad, c.ink, 1.5, a);
      if (s.ringBest) p.ring(q.x, q.y, this.maxR + 3, c.ink, 1, s.ringBest * a);
      p.text(String(theirs), q.x, base, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    }
  }
}
