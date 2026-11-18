import type { Colors } from "./Palette";
import type { Surface } from "./Surface";
import { Rng } from "./Rng";

export const Type = {
  /** Cormorant Garamond italic 300: prompts, titles and takeaways. */
  display: (px: number): string => `italic 300 ${px}px "Cormorant Garamond", "EB Garamond", Georgia, serif`,
  /** Jost: labels and body. Only weights 300 and 400 are loaded. */
  body: (px: number, weight: 300 | 400 = 400): string => `${weight} ${px}px "Jost", "DM Sans", system-ui, sans-serif`,
  /** JetBrains Mono 400: numbers and formulas. */
  mono: (px: number): string => `400 ${px}px "JetBrains Mono", ui-monospace, monospace`,
} as const;

export interface TextOpts {
  font: string;
  color: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  alpha?: number;
}

/** Minimum clear space, in css pixels, between text and anything else. */
const GAP = 3;

type AuditItem =
  | { k: "t"; s: string; x0: number; y0: number; x1: number; y1: number }
  | { k: "c"; cx: number; cy: number; r: number; ring: boolean }
  | { k: "l"; x1: number; y1: number; x2: number; y2: number }
  | { k: "r"; x: number; y: number; w: number; h: number };

/**
 * Drawing helpers on top of a Surface. Text and hairlines are snapped to whole
 * device pixels so they stay crisp, and all text is drawn here, in the canvas,
 * never floated above it as page text.
 */
export class Painter {
  readonly ctx: CanvasRenderingContext2D;
  private backdrop: HTMLCanvasElement | null = null;
  private backdropKey = "";
  private readonly surface: Surface;
  private log: AuditItem[] | null = null;

  constructor(surface: Surface) {
    this.surface = surface;
    this.ctx = surface.ctx;
  }

  get w(): number {
    return this.surface.w;
  }
  get h(): number {
    return this.surface.h;
  }
  get dpr(): number {
    return this.surface.dpr;
  }

  /** One device pixel in css units. */
  get hair(): number {
    return 1 / this.surface.dpr;
  }

  /** Layout auditing records every text box and shape so overlaps can be found automatically. See docs/LAYOUT.md. */
  auditOn(on: boolean): void {
    this.log = on ? [] : null;
  }

  private note(item: AuditItem, alpha: number): void {
    if (this.log && alpha >= 0.15) this.log.push(item);
  }

  /** Returns a list of layout problems found in the frame just drawn. Empty means clean. */
  audit(): string[] {
    const log = this.log ?? [];
    const out: string[] = [];
    const texts = log.filter((i): i is Extract<AuditItem, { k: "t" }> => i.k === "t");
    const W = this.w;
    const H = this.h;
    const q = (s: string) => `"${s.length > 28 ? `${s.slice(0, 28)}...` : s}"`;
    for (const t of texts) {
      if (t.x0 < 2 || t.x1 > W - 2 || t.y0 < 0 || t.y1 > H) out.push(`${q(t.s)} leaves the canvas`);
    }
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i]!;
        const b = texts[j]!;
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        // Breathing room: two text blocks need at least GAP clear pixels between them.
        if (ox > -GAP && oy > -GAP + 1) out.push(`text ${q(a.s)} is too close to text ${q(b.s)}`);
      }
    }
    for (const t of texts) {
      for (const it of log) {
        if (it.k === "c") {
          const nx = Math.max(t.x0, Math.min(it.cx, t.x1));
          const ny = Math.max(t.y0, Math.min(it.cy, t.y1));
          const near = Math.hypot(nx - it.cx, ny - it.cy);
          const far = Math.max(Math.hypot(t.x0 - it.cx, t.y0 - it.cy), Math.hypot(t.x1 - it.cx, t.y0 - it.cy), Math.hypot(t.x0 - it.cx, t.y1 - it.cy), Math.hypot(t.x1 - it.cx, t.y1 - it.cy));
          const crosses = it.ring ? near < it.r + GAP && far > it.r - GAP : near < it.r + GAP && far > it.r;
          if (crosses) out.push(`text ${q(t.s)} overlaps a ${it.ring ? "ring" : "disc"} at ${Math.round(it.cx)},${Math.round(it.cy)}`);
        } else if (it.k === "l") {
          if (segHitsBox(it.x1, it.y1, it.x2, it.y2, t.x0 - GAP, t.y0 - GAP, t.x1 + GAP, t.y1 + GAP)) out.push(`a line is on or too close to text ${q(t.s)}`);
        } else if (it.k === "r") {
          const hit = t.x1 + GAP > it.x && t.x0 - GAP < it.x + it.w && t.y1 + GAP > it.y && t.y0 - GAP < it.y + it.h;
          const contained = t.x0 >= it.x && t.x1 <= it.x + it.w && t.y0 >= it.y && t.y1 <= it.y + it.h;
          if (hit && !contained) out.push(`text ${q(t.s)} straddles a filled shape`);
        }
      }
    }
    return [...new Set(out)];
  }

  snap(v: number): number {
    return Math.round(v * this.surface.dpr) / this.surface.dpr;
  }

  /** Ground, one soft light from above and a coarse grain, cached and blitted 1:1. */
  clear(c: Colors): void {
    if (this.log) this.log.length = 0;
    const { canvas, dpr } = this.surface;
    const key = `${canvas.width}x${canvas.height}@${dpr}|${c.ground}|${c.glow}|${c.ink}`;
    if (!this.backdrop || this.backdropKey !== key) {
      this.backdropKey = key;
      const b = this.backdrop ?? document.createElement("canvas");
      b.width = canvas.width;
      b.height = canvas.height;
      const g = b.getContext("2d")!;
      g.fillStyle = c.ground;
      g.fillRect(0, 0, b.width, b.height);
      const r = Math.max(b.width, b.height) * 0.85;
      const grad = g.createRadialGradient(b.width * 0.5, -r * 0.1, 0, b.width * 0.5, -r * 0.1, r);
      grad.addColorStop(0, c.glow);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, b.width, b.height);
      this.grain(g, b.width, b.height, c.ink);
      this.backdrop = b;
    }
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.backdrop, 0, 0);
    this.ctx.restore();
  }

  private grain(g: CanvasRenderingContext2D, w: number, h: number, ink: string): void {
    const tile = document.createElement("canvas");
    tile.width = 96;
    tile.height = 96;
    const t = tile.getContext("2d")!;
    const rng = new Rng(7);
    t.fillStyle = ink;
    for (let i = 0; i < 520; i++) {
      t.globalAlpha = 0.025 + rng.next() * 0.035;
      t.fillRect(rng.int(0, 95), rng.int(0, 95), 1, 1);
    }
    g.fillStyle = g.createPattern(tile, "repeat")!;
    g.fillRect(0, 0, w, h);
  }

  text(s: string, x: number, y: number, o: TextOpts): void {
    const c = this.ctx;
    c.font = o.font;
    c.fillStyle = o.color;
    c.textAlign = o.align ?? "left";
    c.textBaseline = o.base ?? "alphabetic";
    c.globalAlpha = o.alpha ?? 1;
    const sx = this.snap(x);
    const sy = this.snap(y);
    c.fillText(s, sx, sy);
    c.globalAlpha = 1;
    if (this.log && s.trim()) {
      const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(o.font)?.[1] ?? "14");
      const w = c.measureText(s).width;
      const x0 = o.align === "center" ? sx - w / 2 : o.align === "right" ? sx - w : sx;
      const mid = o.base === "middle";
      this.note({ k: "t", s, x0, x1: x0 + w, y0: mid ? sy - size * 0.4 : sy - size * 0.74, y1: mid ? sy + size * 0.4 : sy + size * 0.2 }, o.alpha ?? 1);
    }
  }

  measure(s: string, font: string): number {
    this.ctx.font = font;
    return this.ctx.measureText(s).width;
  }

  wrap(s: string, font: string, maxW: number): string[] {
    this.ctx.font = font;
    const out: string[] = [];
    let line = "";
    for (const word of s.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && this.ctx.measureText(next).width > maxW) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  }

  /** Draws wrapped text and returns the y of the line after the last one. */
  paragraph(s: string, x: number, y: number, maxW: number, lineH: number, o: TextOpts): number {
    let cy = y;
    for (const line of this.wrap(s, o.font, maxW)) {
      this.text(line, x, cy, o);
      cy += lineH;
    }
    return cy;
  }

  disc(x: number, y: number, r: number, color: string, alpha = 1): void {
    if (r <= 0) return;
    if (r >= 1.5) this.note({ k: "c", cx: x, cy: y, r, ring: false }, alpha);
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }

  ring(x: number, y: number, r: number, color: string, lw = 1, alpha = 1): void {
    if (r <= 0) return;
    if (r >= 1.5) this.note({ k: "c", cx: x, cy: y, r, ring: true }, alpha);
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
  }

  arc(x: number, y: number, r: number, a0: number, a1: number, color: string, lw = 1, alpha = 1): void {
    this.note({ k: "c", cx: x, cy: y, r, ring: true }, alpha);
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = "butt";
    c.beginPath();
    c.arc(x, y, r, a0, a1);
    c.stroke();
    c.globalAlpha = 1;
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, lw = 1, alpha = 1, dash?: number[]): void {
    if (alpha >= 0.2) this.note({ k: "l", x1, y1, x2, y2 }, 1);
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.setLineDash(dash ?? []);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
  }

  /** A one device pixel horizontal or vertical rule, aligned to the pixel grid. */
  rule(x1: number, y1: number, x2: number, y2: number, color: string, alpha = 1): void {
    const h = this.hair;
    const ax = x1 === x2 ? this.snap(x1) + h / 2 : x1;
    const bx = x1 === x2 ? this.snap(x2) + h / 2 : x2;
    const ay = y1 === y2 ? this.snap(y1) + h / 2 : y1;
    const by = y1 === y2 ? this.snap(y2) + h / 2 : y2;
    this.line(ax, ay, bx, by, color, h, alpha);
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    if (alpha >= 0.3) this.note({ k: "r", x, y, w, h }, 1);
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.snap(x), this.snap(y), this.snap(w), this.snap(h));
    this.ctx.globalAlpha = 1;
  }

  frame(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    const hp = this.hair;
    if (alpha >= 0.2) {
      this.note({ k: "l", x1: x, y1: y, x2: x + w, y2: y }, 1);
      this.note({ k: "l", x1: x + w, y1: y, x2: x + w, y2: y + h }, 1);
      this.note({ k: "l", x1: x, y1: y + h, x2: x + w, y2: y + h }, 1);
      this.note({ k: "l", x1: x, y1: y, x2: x, y2: y + h }, 1);
    }
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = hp;
    this.ctx.strokeRect(this.snap(x) + hp / 2, this.snap(y) + hp / 2, this.snap(w) - hp, this.snap(h) - hp);
    this.ctx.globalAlpha = 1;
  }

  arrow(x1: number, y1: number, x2: number, y2: number, color: string, lw = 1.25, alpha = 1, head = 7): void {
    const a = Math.atan2(y2 - y1, x2 - x1);
    this.line(x1, y1, x2, y2, color, lw, alpha);
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(x2 - head * Math.cos(a - 0.5), y2 - head * Math.sin(a - 0.5));
    c.lineTo(x2, y2);
    c.lineTo(x2 - head * Math.cos(a + 0.5), y2 - head * Math.sin(a + 0.5));
    c.stroke();
    c.globalAlpha = 1;
  }

  /** A dashed ring, used for "what the other choice would have paid". */
  dashedRing(x: number, y: number, r: number, color: string, alpha = 1): void {
    if (r < 3 || alpha < 0.02) return;
    this.note({ k: "c", cx: x, cy: y, r, ring: true }, alpha);
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = 1.25;
    c.setLineDash([3, 4]);
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  /** A polyline. Every segment is audited, so curves cannot run through labels unnoticed. */
  path(points: readonly (readonly [number, number])[], color: string, lw = 1.5, alpha = 1): void {
    if (points.length < 2) return;
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineJoin = "round";
    c.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
    c.stroke();
    c.globalAlpha = 1;
    if (this.log && alpha >= 0.2) for (let i = 1; i < points.length; i++) this.log.push({ k: "l", x1: points[i - 1]![0], y1: points[i - 1]![1], x2: points[i]![0], y2: points[i]![1] });
  }
}

/** Does the segment touch the box? (Liang Barsky clipping.) */
function segHitsBox(x1: number, y1: number, x2: number, y2: number, bx0: number, by0: number, bx1: number, by1: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - bx0, bx1 - x1, y1 - by0, by1 - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i]! < 0) return false;
    } else {
      const r = q[i]! / p[i]!;
      if (p[i]! < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}
