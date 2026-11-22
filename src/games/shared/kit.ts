import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import type { Box } from "../../core/Geometry";
import type { Frame } from "../../core/Game";
import { clamp } from "../../core/math";
import { Glyph } from "./glyphs";
import type { MatrixView } from "./MatrixView";
import type { PayoffTable } from "./PayoffTable";

/** Whole numbers stay whole, everything else keeps at most two decimals. */
export const fmt = (v: number): string => String(Math.round(v * 100) / 100);

/** A horizontal track with one draggable value from 0 to 1. Pure geometry, drawn by the game. */
export class Slider {
  x0 = 0;
  x1 = 0;
  y = 0;
  value = 0;
  dragging = false;

  place(x0: number, x1: number, y: number): void {
    this.x0 = x0;
    this.x1 = x1;
    this.y = y;
  }

  get x(): number {
    return this.x0 + this.value * (this.x1 - this.x0);
  }

  at(v: number): number {
    return this.x0 + v * (this.x1 - this.x0);
  }

  /** Move to the pointer, optionally snapping to steps of `step` (in 0 to 1 units). */
  setFromX(x: number, step = 0): void {
    let v = clamp((x - this.x0) / (this.x1 - this.x0), 0, 1);
    if (step > 0) v = Math.round(v / step) * step;
    this.value = clamp(v, 0, 1);
  }

  /** The track, its end ticks and the knob. */
  draw(p: Painter, c: Colors, alpha = 1): void {
    p.rule(this.x0, this.y, this.x1, this.y, c.ink, 0.5 * alpha);
    for (const v of [0, 1]) p.rule(this.at(v), this.y - 5, this.at(v), this.y + 5, c.ink, 0.5 * alpha);
    p.disc(this.x, this.y, 9, c.ink, alpha);
  }
}

/** The tick row at the bottom: one mark per step, filled when done. Centred on cx. */
export function drawTicks(p: Painter, c: Colors, f: Frame, cx: number, total: number, done: number, active: number): void {
  const gap = 20;
  const x0 = cx - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) Glyph.step(p, c, x0 + i * gap, f.tickY, i < done, i === active);
}

export interface ChoiceOpts {
  label: string;
  sub: string;
  /** Radius of the disc in the box. Zero draws none. */
  r: number;
  alpha?: number;
  armed?: boolean;
  chosen?: boolean;
  dashed?: boolean;
  /** Draw the disc as a ring, for what the other player gets. */
  ring?: boolean;
}

/** A choice box in the action row: a frame, a disc sized by what it pays, a name and a small line. */
export function drawChoice(p: Painter, c: Colors, z: Box, o: ChoiceOpts): void {
  const a = o.alpha ?? 1;
  p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * a);
  p.rect(z.x, z.y, z.w, z.h, c.ink, o.armed ? 0.08 : 0);
  const gx = z.x + z.w / 2;
  const r = Math.min(o.r, z.h * 0.2);
  if (o.dashed) p.dashedRing(gx, z.y + z.h * 0.3, r, c.ink, 0.9 * a);
  else if (o.ring) p.ring(gx, z.y + z.h * 0.3, r, c.ink, 1.5, a);
  else p.disc(gx, z.y + z.h * 0.3, r, c.ink, 0.92 * a);
  p.text(o.label, gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: a });
  p.text(o.sub, gx, z.y + z.h - 9, { font: Type.body(11, 400), color: c.fog, align: "center", alpha: a });
}

/**
 * One cell of a two player table: you are the filled disc on the left, the other player is the ring on the right,
 * areas carry the payoffs and the numbers sit under their discs.
 */
export function drawPayoffCell(p: Painter, c: Colors, mv: MatrixView, r: number, col: number, bm: PayoffTable, alpha = 1): void {
  const b = mv.rect(r, col);
  const [you, them] = bm.payoff(r, col);
  const rMax = mv.cell * 0.2;
  const rad = (v: number) => (v <= 0 ? 0 : rMax * Math.sqrt(v / bm.max));
  const off = mv.cell * 0.22;
  const y = b.y + mv.cell * 0.4;
  const cx = b.x + b.w / 2;
  p.disc(cx - off, y, rad(you), c.ink, 0.92 * alpha);
  p.ring(cx + off, y, rad(them), c.ink, 1.5, alpha);
  const ty = b.y + b.h - 10;
  p.text(fmt(you), cx - off, ty, { font: Type.mono(11), color: c.fog, align: "center", alpha });
  p.text(fmt(them), cx + off, ty, { font: Type.mono(11), color: c.fog, align: "center", alpha });
}

/** Row and column names around a table: a filled disc by each row, a ring by each column. */
export function drawMatrixLabels(p: Painter, c: Colors, mv: MatrixView, bm: PayoffTable, alpha = 1): void {
  bm.rowNames.forEach((n, r) => {
    p.disc(mv.x0 - mv.rowLabelW + 8, mv.rowY(r), 4, c.ink, alpha);
    p.text(n, mv.x0 - 10, mv.rowY(r), { font: Type.body(14, 400), color: c.ink, align: "right", base: "middle", alpha });
  });
  bm.colNames.forEach((n, col) => {
    p.ring(mv.colX(col), mv.y0 - 44, 5, c.ink, 1.5, alpha);
    p.text(n, mv.colX(col), mv.y0 - 16, { font: Type.body(14, 400), color: c.ink, align: "center", base: "middle", alpha });
  });
}

/** Three equal choice boxes filling the action row. */
export function trio(f: Frame, i: number): Box {
  const bw = (f.w - 24) / 3;
  return { x: f.x + i * (bw + 12), y: f.actionY, w: bw, h: f.actionH };
}
