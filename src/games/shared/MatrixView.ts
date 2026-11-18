import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";

import { inside, type Box } from "../../core/Geometry";

export { inside };
export type { Box };

/** Geometry and hairlines of a 2x2 table. Rows belong to you, columns to the other player. */
export class MatrixView {
  readonly rowLabelW = 84;
  readonly colLabelH = 66;
  cell = 110;
  x0 = 0;
  y0 = 0;

  fit(cx: number, top: number, maxW: number, maxH: number, maxCell = 150): void {
    const byW = (maxW - this.rowLabelW) / 2;
    const byH = (maxH - this.colLabelH) / 2;
    this.cell = Math.floor(Math.max(56, Math.min(maxCell, byW, byH)));
    const total = this.rowLabelW + 2 * this.cell;
    this.x0 = Math.round(cx - total / 2 + this.rowLabelW);
    this.y0 = Math.round(top + this.colLabelH);
  }

  get right(): number {
    return this.x0 + 2 * this.cell;
  }
  get bottom(): number {
    return this.y0 + 2 * this.cell;
  }
  /** Largest payoff disc radius. Area, not radius, carries the value. */
  get maxR(): number {
    return this.cell * 0.36;
  }

  radius(value: number, max = 9): number {
    return value <= 0 ? 0 : this.maxR * Math.sqrt(Math.min(1, value / max));
  }

  rect(r: number, c: number): Box {
    return { x: this.x0 + c * this.cell, y: this.y0 + r * this.cell, w: this.cell, h: this.cell };
  }

  center(r: number, c: number): { x: number; y: number } {
    const b = this.rect(r, c);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  rowStrip(r: number): Box {
    return { x: this.x0 - this.rowLabelW, y: this.y0 + r * this.cell, w: this.rowLabelW + 2 * this.cell, h: this.cell };
  }

  colStrip(c: number): Box {
    return { x: this.x0 + c * this.cell, y: this.y0 - this.colLabelH, w: this.cell, h: this.colLabelH + 2 * this.cell };
  }

  /** The other row of a 2x2 table. */
  matrixOther(r: number): number {
    return r === 0 ? 1 : 0;
  }

  rowY(r: number): number {
    return this.y0 + r * this.cell + this.cell / 2;
  }

  colX(c: number): number {
    return this.x0 + c * this.cell + this.cell / 2;
  }

  grid(p: Painter, c: Colors, alpha = 1): void {
    const { x0, y0, cell } = this;
    p.frame(x0, y0, 2 * cell, 2 * cell, c.ink, 0.3 * alpha);
    p.rule(x0 + cell, y0, x0 + cell, y0 + 2 * cell, c.ink, 0.3 * alpha);
    p.rule(x0, y0 + cell, x0 + 2 * cell, y0 + cell, c.ink, 0.3 * alpha);
  }

  /** A small payoff number in the corner of a cell. */
  number(p: Painter, c: Colors, r: number, col: number, value: number, alpha = 1): void {
    const b = this.rect(r, col);
    p.text(String(Math.round(value * 10) / 10), b.x + b.w - 7, b.y + b.h - 7, { font: Type.mono(11), color: c.fog, align: "right", alpha });
  }
}

