import { Damped } from "./Damped";
import type { Painter, TextOpts } from "./Painter";

/** A block of canvas text that fades in when its words change. */
export class Caption {
  private text = "";
  private readonly alpha = new Damped(1, 0.18);
  private font: string;
  private lineH: number;
  /** Lines drawn on the last frame. The layout auditor requires prompts and notes to stay within two. */
  lines = 0;
  private readonly tone: "ink" | "fog" | "ash";

  constructor(font: string, lineH: number, tone: "ink" | "fog" | "ash" = "ink") {
    this.font = font;
    this.lineH = lineH;
    this.tone = tone;
  }

  setSize(font: string, lineH: number): void {
    this.font = font;
    this.lineH = lineH;
  }

  set(text: string): void {
    if (text === this.text) return;
    this.text = text;
    this.alpha.snap(0);
    this.alpha.set(1);
  }

  step(dt: number): void {
    this.alpha.step(dt);
  }

  /** Draws and returns the y after the last line. */
  draw(p: Painter, colors: { ink: string; fog: string; ash: string }, x: number, y: number, maxW: number, align: CanvasTextAlign = "left"): number {
    const o: TextOpts = { font: this.font, color: colors[this.tone], align, alpha: this.alpha.value };
    this.lines = this.text ? p.wrap(this.text, this.font, maxW).length : 0;
    return p.paragraph(this.text, x, y, maxW, this.lineH, o);
  }
}
