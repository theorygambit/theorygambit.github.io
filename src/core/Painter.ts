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

  snap(v: number): number {
    return Math.round(v * this.surface.dpr) / this.surface.dpr;
  }

  /** Ground, one soft light from above and a coarse grain, cached and blitted 1:1. */
  clear(c: Colors): void {
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
    c.fillText(s, this.snap(x), this.snap(y));
    c.globalAlpha = 1;
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
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.snap(x), this.snap(y), this.snap(w), this.snap(h));
    this.ctx.globalAlpha = 1;
  }

  frame(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    const hp = this.hair;
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
}
